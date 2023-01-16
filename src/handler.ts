import { Router } from "itty-router";
import { v4 as uuidv4 } from "uuid";

type RetryConfigType = {
    numberOfRetries: number;
    retryInterval: number;
    timeout: number;
};

type RequestType = {
    requestId: string;
    eventId: string;
    request: {
        endpoint: string;
        method: string;
        headers: any;
        body?: any;
        tries?: number;
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
    requests: RequestType[];
    updatedAt: string;
    tries?: number;
};

type Keys = {
    name: string;
};

interface Endpoint {
    url: string;
    credentials: {
        username: string;
        password: string;
    };
}

interface Configs {
    customerId: string;
    endpoints: Endpoint[];
}

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST,DELETE",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
};

function arrayToObject(arr: any[]) {
    return arr.reduce((obj, item) => {
        obj[item.key] = item.value;
        return obj;
    }, {});
}

const router = Router();

const configs = {
    customerId: "e5fecf1f-4372-443e-b5d3-a7f69b769fd3",
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

router.post("/api/sync", async (request, env) => {
    const retryConfig: RetryConfigType = JSON.parse(
        await env.Configs.get("retryconfig")
    );

    const body = await request.json();

    // const requestResponse: { endpoint: string, request: any, response?: any, error?: any, tries?: number, eventId?: string, requestId?: string, createdAt?: string }[] = [];
    const requestResponse: RequestType[] = [];

    const eventId = uuidv4();

    const callEndpoint = async (
        endpoint: Endpoint,
        index: number
    ): Promise<any> => {
        let retryCount = 0;
        const customHeaders = arrayToObject(
            JSON.parse(await env.Configs.get("headers"))
        );
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
                    fetch(endpoint.url, requestOptions),
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
                            endpoint: endpoint.url,
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
                        endpoint: endpoint.url,
                        response: body,
                    };
                } else {
                    const res = await response.json();
                    console.log("response", res);
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
                                endpoint: endpoint.url,
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
                        `Failed to fetch from ${endpoint.url}. Status: ${response.status}`
                    );
                }
            } catch (error: any) {
                if (error.message === "timeout") {
                    throw error;
                }
                retryCount++;
                console.log(
                    `Retrying ${endpoint.url} (${retryCount}/${retryConfig?.numberOfRetries})`
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
        configs.endpoints.map((endpoint, i) => callEndpoint(endpoint, i))
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
});

router.get("/users", async (request, env) => {
    const customHeaders = arrayToObject(
        JSON.parse(await env.Configs.get("headers"))
    );
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

router.get("/events/:eventId/:requestId", async (request, env) => {
    const { eventId, requestId } = request.params;
    const data: EventType = JSON.parse(await env.EventsList.get(eventId));
    const responseData: RequestType | undefined = data.requests.find(
        (req: RequestType) => req.requestId === requestId
    );
    return Response.json(data ? responseData : {}, {
        headers: { ...corsHeaders },
    });
});

router.post("/users", async (request, env) => {
    const body = await request.json();
    const customHeaders = arrayToObject(
        JSON.parse(await env.Configs.get("headers"))
    );

    const retryConfig: RetryConfigType = JSON.parse(
        await env.Configs.get("retryconfig")
    );

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
        const customHeaders = arrayToObject(
            JSON.parse(await env.Configs.get("headers"))
        );
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
            { error: true, message: "Something went wrong" },
            {
                headers: { ...corsHeaders },
            }
        );
    }
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
