import { getEventDetails, getOneCustomerDetails } from "../helper";
import {
    Env,
    BulkRequestResendType,
    EventType,
    Endpoint,
    RequestType,
    CustomHeaders,
    RetryConfig,
} from "../types";
import { arrayToObject } from "../utils/constant";
import { v4 as uuidv4 } from "uuid";
import { IRequest } from "itty-router";

export const bulkRequestResend = (request: IRequest, env: Env) => {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();

    server.send(JSON.stringify({ message: "Hello form server!" }));

    server.addEventListener("message", async ({ data }) => {
        const { customerId, eventId, requests }: BulkRequestResendType = JSON.parse(data.toString());

        const customerDetails = await getOneCustomerDetails(env, {
            name: customerId,
        });

        if ("error" in customerDetails) {
            return server.send(
                JSON.stringify({
                    error: customerDetails.error,
                    message: customerDetails.message,
                    errorCode: customerDetails.errorCode,
                })
            );
        }
        const eventString = await getEventDetails({ name: eventId }, env);
        if (!eventString) {
            return server.send(
                JSON.stringify({
                    error: true,
                    message: "Event details not found.",
                })
            );
        }
        const eventArray: EventType = JSON.parse(eventString);

        const callEndpoint = async (
            endpoint: Endpoint,
            request: RequestType
        ): Promise<any> => {
            const customHeaders: CustomHeaders = endpoint.headers
                ? arrayToObject(endpoint.headers)
                : {};
            const retryConfig: RetryConfig = endpoint.retryConfig
                ? endpoint.retryConfig
                : { numberOfRetries: 1, retryInterval: 2000, timeout: 10000 };

            let retryCount = 0;
            const requestResponse: RequestType = {
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
            while (retryCount < retryConfig.numberOfRetries) {
                const requestOptions = {
                    method: request.request.method,
                    headers: {
                        "Content-Type": "application/json",
                        ...customHeaders,
                    },
                    ...(true && {
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
                    let status = response.status;
                    if (response.ok) {
                        const res = await response.json();
                        requestResponse.requestId = uuidv4();
                        requestResponse.eventId = eventId;
                        requestResponse.endpointId = endpoint.endpointId;
                        requestResponse.request = {
                            endpoint: endpoint.endpoint,
                            tries: retryCount + 1,
                            ...requestOptions,
                        };
                        requestResponse.response = {
                            response: res,
                            status,
                        };
                        requestResponse.createdAt = new Date().toISOString();
                    } else {
                        const res = await response.json();

                        requestResponse.requestId = uuidv4();
                        requestResponse.eventId = eventId;
                        requestResponse.endpointId = endpoint.endpointId;
                        requestResponse.request = {
                            endpoint: endpoint.endpoint,
                            tries: retryCount + 1,
                            ...requestOptions,
                        };
                        requestResponse.response = {
                            response: res,
                            status,
                        };
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
                    }
                }
            }
            server.send(JSON.stringify(requestResponse));
            // eventArray.requests.push(requestResponse);
            // eventArray.updatedAt = new Date().toISOString();
            // await env.EventsList.put(eventId, JSON.stringify(event));
        };

        await Promise.all(
            requests.map(async (req) => {
                const endpointDetails = customerDetails.endpoints.find(
                    (request) => request.endpoint === req.request.endpoint
                );
                if (endpointDetails) {
                    await callEndpoint(endpointDetails, req);
                }
            })
        );

        // requests.map(async (req, i) => {
        //     const response = await fetch(req.request.endpoint);
        //     server.send(
        //         JSON.stringify({
        //             status: response.status,
        //             data: await response.json(),
        //         })
        //     );
        // });
    });

    return new Response(null, {
        status: 101,
        webSocket: client,
    });
};
