export interface Env {
    EventsList: KVNamespace;
    Configs: KVNamespace;
    Customers: KVNamespace;
 }

export type RetryConfig = {
    numberOfRetries: number;
    retryInterval: number;
    timeout: number;
};

export type CustomHeaders = {
    [key: string]: [value: any];
}

export type RequestType = {
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

export type ResponseType = {
    endpoint: string;
    response: any;
};

export type EventType = {
    eventId: string;
    customerId: string;
    requests: RequestType[];
    updatedAt: string;
    tries?: number;
};

export type Keys = {
    name: string;
};

export type Endpoint = {
    endpointId: string;
    endpoint: string;
    headers: {key: string, value: string}[];
    retryConfig: RetryConfig;
}

export type Configs = {
    customerId: string;
    endpoints: Endpoint[];
}

export type Customer = {
    customerId?: string;
    customerName?: string;
    host?: string;
    endpoints: Endpoint[];
}

export type Error = {
    error: boolean;
    message: string;
    errorCode: number;
}