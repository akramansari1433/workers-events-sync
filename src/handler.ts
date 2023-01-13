import { Router } from "itty-router";
import { v4 as uuidv4 } from "uuid";

type RetryConfigType = {
    numberOfRetries: number;
    retryInterval: number;
    timeout: number;
};

type ResquestType = {
    requestId: string;
    eventId: string;
    request: {
        endpoint: string;
        method: string;
        headers: any;
        body?: any;
    };
    response: {
        status?: number;
        response: any;
    };
    createdAt: string;
};

type ResponseType = {
    endpoint: string;
    response: any;
};

type EventType = {
    eventId: string;
    customerId: string;
    requests: ResquestType[];
    updatedAt: string;
    tries?: number;
};

type Keys = {
    name: string;
};

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST,DELETE",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
};

const router = Router();
const configs = {
    customerId: "e4fecf1f-4372-443e-b5d3-a7f69b769fd3",
    endpoints: [
        {
            url: "https://lingering-haze-67b1.star-lord.workers.dev/api/users",
            credentials: {
                username: "test",
                password: "test",
            },
        },
        {
            url: "https://data.sync-machine.workers.dev/api/users",
            credentials: {
                username: "test",
                password: "test",
            },
        },
    ],
};

router.get("/users", async (request, env) => {
    const fetchObject = {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    };

    let requestsData: ResquestType[] = [];
    const eventId = uuidv4();
    const responseArray: ResponseType[] = await Promise.all(
        configs.endpoints.map(async (endpoint, i) => {
            let status;
            const response = await fetch(endpoint.url, fetchObject).then(
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
                    endpoint: endpoint.url,
                    ...fetchObject,
                },
                response: {
                    status,
                    response: data,
                },
                createdAt: new Date().toISOString(),
            });

            return {
                endpoint: endpoint.url,
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
});

router.get("/events", async (request, env) => {
    const keys: Keys[] = (await env.EventsList.list()).keys;
    const values: string[] = await Promise.all(
        keys.map(async (key) => await env.EventsList.get(key.name))
    );

    const data: EventType[] = values.map((value) => JSON.parse(value));

    return Response.json(data, {
        headers: { ...corsHeaders },
    });
});

router.get("/events/:key/:eventId", async (request, env) => {
    const { key, eventId } = request.params;
    const data = JSON.parse(await env.EventsList.get(key));
    const responseData: ResquestType[] = data.events.filter(
        (event: ResquestType) => event.eventId === eventId
    );
    return Response.json(data ? responseData : {}, {
        headers: { ...corsHeaders },
    });
});

router.post("/users", async (request, env) => {
    const body = await request.json();
    const fetchObject = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    };

    let requestData: ResquestType[] = [];
    const eventId = uuidv4();
    const responseArray: ResponseType[] = await Promise.all(
        configs.endpoints.map(async (endpoint, i) => {
            let status;
            const response = await fetch(endpoint.url, fetchObject).then(
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
                    endpoint: endpoint.url,
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
                endpoint: endpoint.url,
                response: data,
            };
        })
    );
    await env.EventsList.put(
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
});

router.post("/headers", async (request, env) => {
    const body = await request.json();
    await env.Configs.put("headers", JSON.stringify(body));
    const headers: {} = JSON.parse(await env.Configs.get("headers"));
    return Response.json(
        { message: "Headers added", success: true, headers },
        { headers: { ...corsHeaders } }
    );
});

router.get("/headers", async (request, env) => {
    const headers: {} = JSON.parse(await env.Configs.get("headers"));
    return Response.json({ headers }, { headers: { ...corsHeaders } });
});

router.post("/retryconfig", async (request, env) => {
    const body: RetryConfigType = await request.json();
    if (!body.numberOfRetries || !body.retryInterval || !body.timeout) {
        return Response.json(
            { error: true, message: "Invalid retry config" },
            { headers: { ...corsHeaders } }
        );
    }
    await env.Configs.put("retryconfig", JSON.stringify(body));
    const retryconfig: RetryConfigType = JSON.parse(
        await env.Configs.get("retryconfig")
    );
    return Response.json(
        { message: "Retry config added", success: true, retryconfig },
        { headers: { ...corsHeaders } }
    );
});

router.get("/retryconfig", async (request, env) => {
    const retryconfig: RetryConfigType = JSON.parse(
        await env.Configs.get("retryconfig")
    );
    return Response.json({ retryconfig }, { headers: { ...corsHeaders } });
});

router.post("/request/resend", async (request, env) => {
    const body: {
        eventId: string;
        requestId: string;
        customHeader: boolean;
    } = await request.json();

    let event: EventType = JSON.parse(await env.EventsList.get(body.eventId));
    const req = event.requests.find((req) => req.requestId === body.requestId);
    if (req) {
        let status;
        let headers = { ...req.request.headers };
        const customHeaders = JSON.parse(await env.Configs.get("headers"));
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
        event.requests.push({
            requestId: uuidv4(),
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
            createdAt: new Date().toISOString(),
        });
    }
    event.updatedAt = new Date().toISOString();
    event.tries = 1;
    await env.EventsList.put(body.eventId, JSON.stringify(event));
    return Response.json(event, {
        headers: { ...corsHeaders },
    });
});

router.all(
    "*",
    () =>
        new Response("Not Found.", {
            status: 404,
            headers: { ...corsHeaders },
        })
);

export default router;
