import { Customer } from "../types";

export const CUSTOM_HEADERS = "customHeaders";
export const RETRY_CONFIG = "retryConfig";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST,DELETE",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
};

export const arrayToObject = (arr: any[]) => {
    return arr.reduce((obj, item) => {
        obj[item.key] = item.value;
        return obj;
    }, {});
}

export const configs: Customer = {
    customerId: "e712cc75-967f-4ad8-bbd4-82eb1e426152",
    customerName: "Koons",
    host: "https://www.koons.com/",
    endpoints: [
        {
            endpointId: "ce0534f4-c2aa-4a16-bcfc-d8c2d43b8529",
            endpoint: "https://lingering-haze-67b1.star-lord.workers.dev/api/users",
            headers: [{key: 'Authorization', value: 'ABC'}, {key: 'Agent', value: 'XYZ'}],
            retryConfig: {numberOfRetries: 3,retryInterval: 10000,timeout: 20000}
        },
        {
            endpointId: "5450ac1c-2946-4d27-b4a5-784b0f26cead",
            endpoint: "https://data.sync-machine.workers.dev/api/users",
            headers: [{key: 'Authorization', value: 'ABC'}, {key: 'Agent', value: 'XYZ'}],
            retryConfig: {numberOfRetries: 3,retryInterval: 10000,timeout: 20000}
        }
    ]
};