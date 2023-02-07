import {
    Customer,
    Endpoint,
    Env,
    EventType,
    RequestType,
    RetryConfig,
} from "../types";
import { arrayToObject } from "../utils/constant";
import { v4 as uuidv4 } from "uuid";

export const resendBulkRequestsQueue = async ({
    event,
    customer,
    body,
    env,
}: {
    event: EventType;
    customer: Customer;
    body: { requests: RequestType[] };
    env: Env;
}) => {
    const eventArray = event;
    const requests: RequestType[] = body.requests;
    const callEndpoint = async (
        endpoint: Endpoint,
        request: RequestType
    ): Promise<any> => {
        const retryConfig: RetryConfig = endpoint.retryConfig;
        let retryCount = 0;
        let requestResponse: RequestType = {
            requestId: "",
            eventId: "",
            endpointId: "",
            request: {
                endpoint: "",
                method: "",
                headers: null,
                body: null,
                tries: 0,
            },
            response: {
                status: 0,
                response: null,
            },
            createdAt: "",
        };
        while (retryCount < retryConfig?.numberOfRetries) {
            const requestOptions = {
                method: request.request.method,
                headers: { ...arrayToObject(endpoint.headers) },
                ...(request.request.method === "POST" && {
                    body: JSON.stringify(request.request.body),
                }),
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
                const responseData = await response.json();
                if (response.ok) {
                    requestResponse.requestId = uuidv4();
                    requestResponse.eventId = event.eventId;
                    requestResponse.request.endpoint = endpoint.endpoint;
                    requestResponse.request = {
                        endpoint: endpoint.endpoint,
                        tries: retryCount + 1,
                        ...requestOptions,
                        body: request.request.body,
                    };
                    requestResponse.response = {
                        response: responseData,
                        status: response.status,
                    };
                    requestResponse.createdAt = new Date().toISOString();
                    break;
                } else {
                    requestResponse.requestId = uuidv4();
                    requestResponse.eventId = event.eventId;
                    requestResponse.request.endpoint = endpoint.endpoint;
                    requestResponse.request = {
                        endpoint: endpoint.endpoint,
                        tries: retryCount + 1,
                        ...requestOptions,
                        body: request.request.body,
                    };
                    requestResponse.response = {
                        response: responseData,
                        status: response.status,
                    };
                    requestResponse.createdAt = new Date().toISOString();

                    throw new Error(
                        `Failed to fetch from ${endpoint.endpoint}. Status: ${response.status}`
                    );
                }
            } catch (error) {
                retryCount++;
                console.log(
                    `Retrying ${endpoint.endpoint} (${retryCount}/${retryConfig?.numberOfRetries})`
                );
                await new Promise((resolve) =>
                    setTimeout(resolve, retryConfig?.retryInterval)
                );
            }
        }
        eventArray.requests.push(requestResponse);
        await env.EventsList.put(event.eventId, JSON.stringify(eventArray));
    };

    await Promise.all(
        requests.map(async (req) => {
            const endpointDetails = customer.endpoints.find(
                (endpoint) => endpoint.endpoint === req.request.endpoint
            );
            if (endpointDetails) {
                await callEndpoint(endpointDetails, req);
            }
        })
    );
};
