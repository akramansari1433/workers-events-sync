import { RequestLike } from "itty-router";
import { getEventDetails, sortRequests } from "../helper";

import { Env } from "../types";
import { EventType, Keys, RequestType } from "../types";
import { corsHeaders } from "../utils/constant";

export const getEvents = async (request: RequestLike, env: Env) => {
    const keysString = await env.EventsList.list();
    if (keysString) {
        const keys: Keys[] = keysString.keys;

        const values = await Promise.all(keys.map(async (key) => await getEventDetails(key, env)));

        if(!values.length) {
            return Response.json({
                error: true,
                message: "No events found",
            }, {
                headers: { ...corsHeaders }
            })
        }
        
        const data: EventType[] = values.map((value) => {
            if (value) {
                return JSON.parse(value)
            }
        });

        const sortedEvents = sortRequests(data);

        return Response.json(sortedEvents, {
            headers: { ...corsHeaders },
        });
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
