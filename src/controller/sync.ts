import { IRequest } from "itty-router";
import { v4 as uuidv4 } from "uuid";
import { findCustomer, getEndpointDetails, getEventDetails } from "../helper";

import { Customer, CustomHeaders, Env, EventType } from "../types";
import { Endpoint, RequestType, RetryConfig } from "../types";
import { arrayToObject, configs, corsHeaders } from "../utils/constant";

export const syncCallback = async (request: IRequest, env: Env) => {
    const requestHeaders = new Map(request.headers);
    const requestOrigin = requestHeaders.get('origin') as string || 'http://localhost:8000';

    const customer: Customer | undefined = await findCustomer(env, requestOrigin);

    console.log("Customer ===> ", customer);

    if(!customer) {
        return Response.json({
            error: true,
            message: 'Customer not found',
            errorCode: 1001
        }, {
            status: 400,
            headers: { ...corsHeaders }
        })
    }

    const body = await request.json();

    const requestResponse: RequestType[] = [];

    const eventId = uuidv4();

    const callEndpoint = async (endpoint: Endpoint, index: number): Promise<any> => {
        const retryConfig = endpoint.retryConfig;
        const customHeaders = endpoint.headers ? arrayToObject(endpoint.headers) : {};
        let retryCount = 0;

        while (retryCount < retryConfig?.numberOfRetries) {
            const requestOptions = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...customHeaders,
                },
                body: JSON.stringify(body),
            };
            try {
                const response: any = await Promise.race([
                    fetch(endpoint.endpoint, requestOptions),
                    new Promise((resolve, reject) =>
                        setTimeout(
                            () => reject(new Error("timeout")),
                            retryConfig?.timeout
                        )
                    ),
                ]);
                if (response.ok) {
                    const res = await response.json();
                    requestResponse.push({
                        requestId: uuidv4(),
                        eventId,
                        endpointId: endpoint.endpointId,
                        request: {
                            endpoint: endpoint.endpoint,
                            tries: retryCount + 1,
                            ...requestOptions,
                        },
                        response: {
                            response: res,
                            status: res.status,
                        },
                        createdAt: new Date().toISOString(),
                    });
                    return {
                        endpoint: endpoint.endpoint,
                        response: body,
                    };
                } else {
                    const res = await response.json();

                    if (requestResponse.length >= index + 1) {
                        requestResponse[index].response = {
                            ...res,
                        };
                        requestResponse[index].request.tries = retryCount + 1;
                    } else {
                        requestResponse.push({
                            requestId: uuidv4(),
                            eventId,
                            endpointId: endpoint.endpointId,
                            request: {
                                endpoint: endpoint.endpoint,
                                tries: retryCount + 1,
                                ...requestOptions,
                            },
                            response: {
                                ...res,
                            },
                            createdAt: new Date().toISOString(),
                        });
                    }
                    throw new Error(
                        `Failed to fetch from ${endpoint.endpoint}. Status: ${response.status}`
                    );
                }
            } catch (error: any) {
                if (error.message === "timeout") {
                    throw error;
                }
                retryCount++;
                console.log(
                    `Retrying ${endpoint.endpoint} (${retryCount}/${retryConfig?.numberOfRetries})`
                );
                if (retryCount < retryConfig?.numberOfRetries) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, retryConfig?.retryInterval)
                    );
                } else {
                    return error;
                }
            }
        }
    };

    const results = await Promise.all(
        customer.endpoints.map((endpoint: Endpoint, i: number) => callEndpoint(endpoint, i))
    );

    await env.EventsList.put(
        eventId,
        JSON.stringify({
            customerId: configs.customerId,
            eventId,
            requests: requestResponse,
            updatedAt: new Date().toISOString(),
            tries: 1,
        })
    );

    return Response.json(
        { results, requestResponse },
        {
            headers: { ...corsHeaders },
        }
    );
}

export const resendRequestCallback = async (request: IRequest, env: Env) => {
    const body: {
        eventId: string;
        requestId: string;
        customHeader: boolean;
    } = await request.json();

    const { customerId, endpointId } = request.params;

    const endpointDetails = await getEndpointDetails(env, customerId, endpointId);

    if("error" in endpointDetails) {
        return Response.json({ 
            error: endpointDetails.error, 
            message: endpointDetails.message,
            errorCode: endpointDetails.errorCode
        }, {
            status: 400,
            headers: { ...corsHeaders },
        });
    }

    const eventString = await getEventDetails({ name: body.eventId }, env);

    if(!eventString) {
        return Response.json({ 
            error: true, 
            message: "Event details not found."
        }, {
            status: 400,
            headers: { ...corsHeaders },
        });
    }

    const event: EventType = JSON.parse(eventString);

    const req = event.requests.find((req) => req.requestId === body.requestId)?.request;

    if (req) {
        // let status;
        let headers = { ...req.headers };
        const requestResponse: RequestType = {
            requestId: '',
            eventId: '',
            endpointId: '',
            request: {
                endpoint: '',
                method: '',
                headers: null,
                body: null,
                tries: 0,
            },
            response: {
                status: 0,
                response: null,
            },
            createdAt: '',
        };

        
        const callEndpoint = async (endpoint: Endpoint): Promise<any> => {
            const customHeaders: CustomHeaders = endpointDetails.headers ? arrayToObject(endpointDetails.headers) : {};
            const retryConfig: RetryConfig = endpointDetails.retryConfig ? endpointDetails.retryConfig : { numberOfRetries: 1, retryInterval: 2000, timeout: 10000 };

            let retryCount = 0;

            while(retryCount < retryConfig.numberOfRetries) {
                const requestOptions = {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...customHeaders,
                    },
                    body: JSON.stringify(body),
                };

                try {
                    const response: any = await Promise.race([
                        fetch(endpoint.endpoint, requestOptions),
                        new Promise((resolve, reject) =>
                            setTimeout(
                                () => reject(new Error("timeout")),
                                retryConfig?.timeout
                            )
                        ),
                    ]);
                    if (response.ok) {
                        const res = await response.json();
                        
                        requestResponse.requestId = uuidv4();
                        requestResponse.eventId = body.eventId;
                        requestResponse.endpointId = endpoint.endpointId;
                        requestResponse.request = {
                            endpoint: endpoint.endpoint,
                            tries: retryCount + 1,
                            ...requestOptions
                        };
                        requestResponse.response = {
                            response: res,
                            status: res.status,
                        }
                        requestResponse.createdAt = new Date().toISOString();

                        return {
                            endpoint: endpoint.endpoint,
                            response: body,
                        };
                    } else {
                        const res = await response.json();
    
                        requestResponse.requestId = uuidv4();
                        requestResponse.eventId = body.eventId;
                        requestResponse.endpointId = endpoint.endpointId;
                        requestResponse.request = {
                            endpoint: endpoint.endpoint,
                            tries: retryCount + 1,
                            ...requestOptions
                        };
                        requestResponse.response = {
                            response: res,
                            status: res.status,
                        }
                        requestResponse.createdAt = new Date().toISOString();

                        throw new Error(
                            `Failed to fetch from ${endpoint.endpoint}. Status: ${response.status}`
                        );
                    }
                } catch (error: any) {
                    if (error.message === "timeout") {
                        throw error;
                    }
                    retryCount++;
                    console.log(
                        `Retrying ${endpoint.endpoint} (${retryCount}/${retryConfig?.numberOfRetries})`
                    );
                    if (retryCount < retryConfig?.numberOfRetries) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, retryConfig?.retryInterval)
                        );
                    } else {
                        return error;
                    }
                }
            }

        }

        const result = await callEndpoint(endpointDetails)
        
        event.requests.push({
            requestId: requestResponse.requestId,
            eventId: body.eventId,
            endpointId: endpointId,
            request: {
                endpoint: req.endpoint,
                method: req.method,
                headers,
                body: req.body,
            },
            response: {
                status: requestResponse.response.status,
                response: requestResponse.response.response,
            },
            createdAt: requestResponse.createdAt,
        });
        event.updatedAt = new Date().toISOString();
        event.tries = requestResponse.request.tries;

        await env.EventsList.put(
            body.eventId, 
            JSON.stringify(event)
        );

        return Response.json(
            requestResponse,
            {
                headers: { ...corsHeaders },
            }
        );
    } else {
        return Response.json(
            { error: true, message: "Request not found" },
            {
                status: 400,
                headers: { ...corsHeaders },
            }
        );
    }
}