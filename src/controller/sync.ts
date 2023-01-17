import { RequestLike } from "itty-router";
import { v4 as uuidv4 } from "uuid";
import { findCustomer, getRetryConfig } from "../helper";

import { Customer, Env } from "../types";
import { Endpoint, RequestType, RetryConfig } from "../types";
import { arrayToObject, configs, corsHeaders, CUSTOM_HEADERS, RETRY_CONFIG } from "../utils/constant";

export const syncCallback = async (request: RequestLike, env: Env) => {
    const requestHeaders = new Map(request.headers);
    const requestOrigin = requestHeaders.get('origin') as string;

    const customer: Customer | undefined = await findCustomer(env, requestOrigin);

    if(!customer) {
        return Response.json({
            error: true,
            message: 'Customer not found',
            error_code: 1001
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
        let retryCount = 0;
        let customHeaders = []

        const headerString = await env.Configs.get(CUSTOM_HEADERS);

        if(headerString) {
            customHeaders = arrayToObject(JSON.parse(headerString));
        }

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