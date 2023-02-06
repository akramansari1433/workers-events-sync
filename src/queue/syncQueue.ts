import { Customer, Endpoint, Env, RequestType } from "../types";
import { v4 as uuidv4 } from "uuid";
import { arrayToObject } from "../utils/constant";

export const sycnQueue = async ({
    customer,
    method,
    body,
    env,
}: {
    customer: Customer;
    body: any;
    method: string;
    env: Env;
}) => {
    const requestResponse: RequestType[] = [];
    const eventId = uuidv4();

    await Promise.all(
        customer.endpoints.map(async (endpoint, index) => {
            const retryConfig = endpoint.retryConfig;
            let retryCount = 0;
            while (retryCount < retryConfig?.numberOfRetries) {
                const requestOptions = {
                    method,
                    headers: { ...arrayToObject(endpoint.headers) },
                    ...(method === "POST" && {
                        body: JSON.stringify(body),
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
                        requestResponse.push({
                            requestId: uuidv4(),
                            eventId,
                            endpointId: endpoint.endpointId,
                            request: {
                                endpoint: endpoint.endpoint,
                                tries: retryCount + 1,
                                ...requestOptions,
                                body: body,
                            },
                            response: {
                                response: responseData,
                                status: response.status,
                            },
                            createdAt: new Date().toISOString(),
                        });
                        break;
                    } else {
                        if (requestResponse.length >= index + 1) {
                            requestResponse[index].response = {
                                ...responseData,
                                status: response.status,
                            };
                            requestResponse[index].request.tries =
                                retryCount + 1;
                        } else {
                            requestResponse.push({
                                requestId: uuidv4(),
                                eventId,
                                endpointId: endpoint.endpointId,
                                request: {
                                    endpoint: endpoint.endpoint,
                                    tries: retryCount + 1,
                                    ...requestOptions,
                                    body: body,
                                },
                                response: {
                                    ...responseData,
                                    status: response.status,
                                },
                                createdAt: new Date().toISOString(),
                            });
                        }
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
        })
    );
    await env.EventsList.put(
        eventId,
        JSON.stringify({
            customerId: customer.customerId,
            eventId,
            requests: requestResponse,
            updatedAt: new Date().toISOString(),
        })
    );
};
