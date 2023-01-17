import { RequestLike } from "itty-router";
import { v4 as uuidv4 } from "uuid";

import { Env } from "../types";
import { EventType, Keys, RequestType } from "../types";
import { arrayToObject, corsHeaders, CUSTOM_HEADERS } from "../utils/constant";

const getEventDetails = async (key: Keys, env: Env) => {
    const eventString = await env.EventsList.get(key.name)
    if (eventString) {
        return eventString
    } else {
        return null
    }
}

export const getEvents = async (request: RequestLike, env: Env) => {
    const keysString = await env.EventsList.list();
    if (keysString) {
        const keys: Keys[] = keysString.keys;

        const values = await Promise.all(keys.map(async (key) => await getEventDetails(key, env)));

        if (values.length) {
            const data: EventType[] = values.map((value) => {
                if (value) {
                    return JSON.parse(value)
                }
            });

            return Response.json(data, {
                headers: { ...corsHeaders },
            });
        }
    }
}

export const getRequestDetails = async (request: RequestLike, env: Env) => {
    const { eventId, requestId } = request.params;

    const eventDetailsString = await getEventDetails({ name: eventId }, env);

    if (eventDetailsString) {
        const data: EventType = JSON.parse(eventDetailsString);
        const requestDetails: RequestType | undefined = data.requests.find(
            (req: RequestType) => req.requestId === requestId
        );

        if (requestDetails) {
            return Response.json(requestDetails, {
                headers: { ...corsHeaders },
            });
        } else {
            new Response("Request details not found.", {
                status: 400,
                headers: { ...corsHeaders },
            });
        }
    } else {
        return Response.json("Event details not found.", {
            status: 400,
            headers: { ...corsHeaders },
        });
    }
}

export const resendRequestCallback = async (request: RequestLike, env: Env) => {
    const body: {
        eventId: string;
        requestId: string;
        customHeader: boolean;
    } = await request.json();

    const eventString = await getEventDetails({ name: body.eventId }, env);

    if(!eventString) {
        return Response.json("Event details not found.", {
            status: 400,
            headers: { ...corsHeaders },
        });
    }

    const event: EventType = JSON.parse(eventString);

    const req = event.requests.find((req) => req.requestId === body.requestId);

    if (req) {
        let status;
        let headers = { ...req.request.headers };
        let customHeaders = {};

        const customHeadersString = await env.Configs.get(CUSTOM_HEADERS);

        if(customHeadersString) {
            customHeaders = arrayToObject(JSON.parse(customHeadersString));
        }

        if (body.customHeader) {
            headers = {
                ...headers,
                ...customHeaders,
            };
        }

        const response = await fetch(req.request.endpoint, {
            method: req.request.method,
            body: req.request.body,
            headers,
        }).then((response) => {
            status = response.status;
            return response.json();
        });

        const data = await response;
        const requestId = uuidv4();
        const createdAt = new Date().toISOString();
        event.requests.push({
            requestId,
            eventId: body.eventId,
            request: {
                endpoint: req.request.endpoint,
                method: req.request.method,
                headers,
                body: req.request.body,
            },
            response: {
                status,
                response: data,
            },
            createdAt,
        });
        event.updatedAt = new Date().toISOString();
        event.tries = 1;
        await env.EventsList.put(body.eventId, JSON.stringify(event));
        return Response.json(
            {
                requestId,
                eventId: body.eventId,
                request: {
                    endpoint: req.request.endpoint,
                    method: req.request.method,
                    headers,
                    body: req.request.body,
                },
                response: {
                    status,
                    response: data,
                },
                createdAt,
            },
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

