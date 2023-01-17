import { RequestLike } from "itty-router";
import { v4 as uuidv4 } from "uuid";

import { Env } from "../types";
import { RequestType, ResponseType, RetryConfig } from "../types";
import { arrayToObject, configs, corsHeaders, CUSTOM_HEADERS, RETRY_CONFIG } from "../utils/constant";

export const getUsersCallback = async (request: RequestLike, env: Env) => {
    let customHeaders
    const headersString = await env.Configs.get(CUSTOM_HEADERS);

    if (headersString) {
        customHeaders = arrayToObject(JSON.parse(headersString));
    }

    const fetchObject = {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            ...customHeaders,
        },
    };

    let requestsData: RequestType[] = [];
    const eventId = uuidv4();
    const responseArray: ResponseType[] = await Promise.all(
        configs.endpoints.map(async (endpoint, i) => {
            let status;
            const response = await fetch(endpoint.endpoint, fetchObject).then(
                (response) => {
                    status = response.status;
                    return response.json();
                }
            );
            const data = await response;
            requestsData.push({
                requestId: uuidv4(),
                eventId,
                request: {
                    endpoint: endpoint.endpoint,
                    ...fetchObject,
                },
                response: {
                    status,
                    response: data,
                },
                createdAt: new Date().toISOString(),
            });

            return {
                endpoint: endpoint.endpoint,
                response: data,
            };
        })
    );
    await env.EventsList.put(
        eventId,
        JSON.stringify({
            customerId: configs.customerId,
            eventId,
            requests: requestsData,
            updatedAt: new Date().toISOString(),
            tries: 1,
        })
    );
    return Response.json(responseArray, {
        headers: { ...corsHeaders },
    });
}

export const saveUsersCallback = async (request: RequestLike, env: Env) => {
    const body = await request.json();
    let customHeaders

    const customHeaderString = await env.Configs.get(CUSTOM_HEADERS);

    if(customHeaderString) {
        customHeaders = arrayToObject(JSON.parse(customHeaderString));
    }

    const retryConfigString = await env.Configs.get(RETRY_CONFIG);

    if(retryConfigString) {
        const retryConfig: RetryConfig = JSON.parse(retryConfigString);
    }

    const fetchObject = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...customHeaders,
        },
        body: JSON.stringify(body),
    };

    let requestData: RequestType[] = [];
    const eventId = uuidv4();
    const responseArray: ResponseType[] = await Promise.all(
        configs.endpoints.map(async (endpoint, i) => {
            let status;

            const response = await fetch(endpoint.endpoint, fetchObject).then(
                (response) => {
                    status = response.status;
                    return response.json();
                }
            );
            const data = await response;
            requestData.push({
                requestId: uuidv4(),
                eventId,
                request: {
                    endpoint: endpoint.endpoint,
                    ...fetchObject,
                    body: JSON.parse(fetchObject.body),
                },
                response: {
                    status,
                    response: data,
                },
                createdAt: new Date().toISOString(),
            });
            return {
                endpoint: endpoint.endpoint,
                response: data,
            };
        })
    );

    const res = await env.EventsList.put(
        eventId,
        JSON.stringify({
            customerId: configs.customerId,
            eventId,
            requests: requestData,
            updatedAt: new Date().toISOString(),
            tries: 1,
        })
    );

    return Response.json(responseArray, {
        headers: { ...corsHeaders },
    });
}