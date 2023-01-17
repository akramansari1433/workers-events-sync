import { Customer, Endpoint, Env, Keys } from "../types";

export const getCustomerSpecs = async (env: Env, customerId: string) => {
    const existingCustomerString = await env.Customers.get(customerId);
    if (existingCustomerString) {
        const existingCustomer: Customer = JSON.parse(existingCustomerString);
        return {
            customer: existingCustomer
        }
    } else {
        return {
            error: true,
            message: "Customer not found",
            code: 1001
        }
    }
}

export const getCustomHeaders = async (env: Env, customerId: string, endpointId: string) => {
    const customerData = await getCustomerSpecs(env, customerId);

    if(customerData.error || !customerData.customer) {
        return {
            error: customerData.error,
            message: customerData.message,
            code: customerData.code
        }
    }

    const existingCustomer: Customer = customerData.customer;
    const existingEndpoint: Endpoint | undefined = existingCustomer.endpoints.find(data => data.endpointId === endpointId);
    
    if(existingEndpoint) {
        return {
            headers: existingEndpoint.headers
        }
    } else {
        return {
            error: true,
            message: "Endpoint not found",
            code: 1002
        }
    }
}

export const getRetryConfig = async (env: Env, customerId: string, endpointId: string) => {
    const customerData = await getCustomerSpecs(env, customerId);

    if(customerData.error || !customerData.customer) {
        return {
            error: customerData.error,
            message: customerData.message,
            code: customerData.code
        }
    }

    const existingCustomer: Customer = customerData.customer;
    const existingEndpoint: Endpoint | undefined = existingCustomer.endpoints.find(data => data.endpointId === endpointId);
    
    if(existingEndpoint) {
        return {
            retryConfig: existingEndpoint.retryConfig
        }
    } else {
        return {
            error: true,
            message: "Endpoint not found",
            code: 1002
        }
    }
}

export const findCustomer = async (env: Env, origin: string): Promise<Customer | undefined> => {
    const allCustomersKeys = await env.Customers.list();

    if(allCustomersKeys) {
        const keys: Keys[] = allCustomersKeys.keys;

        const existingCustomer = await Promise.all(keys.map(async (key) => {
            const customerString = await env.Customers.get(key.name);
            if(customerString) {
                const customer: Customer = JSON.parse(customerString);
                if (customer.host === origin ) return customer
            }
        }))
        return existingCustomer.find(x => x !== undefined)
    }
    return
}