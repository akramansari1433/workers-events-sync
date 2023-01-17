import { IRequest } from 'itty-router'
import { findCustomer, getCustomerSpecs, getCustomHeaders } from '../helper';

import { Customer, CustomHeaders, Endpoint } from "../types";
import { Env } from "../types";
import { corsHeaders } from "../utils/constant";

const getCustomHeadersCallback = async (request: IRequest, env: Env) => {
    const { customerId, endpointId } = request.params;

    const res = await getCustomHeaders(env, customerId, endpointId);

    if (res.error) {
        return Response.json({
            error: res.error,
            error_code: res.code,
            message: res.message
        }, {
            status: 400,
            headers: { ...corsHeaders }
        })
    }

    return Response.json({
        headers: res.headers
    }, {
        headers: { ...corsHeaders }
    })
}

const saveCustomHeadersCallback = async (request: IRequest, env: Env) => {
    const body: { headers: any } = await request.json();
    const { customerId, endpointId } = request.params;

    if (!Object.keys(body).includes("headers")) {
        return Response.json(
            { error: true, message: "Invalid headers" },
            {
                status: 400,
                headers: { ...corsHeaders }
            }
        );
    }

    if (!body) {
        return Response.json("No headers to save.", {
            status: 400,
            headers: { ...corsHeaders },
        });
    }

    const res = await getCustomerSpecs(env, customerId);

    if (res.error || !res.customer) {
        return Response.json({
            error: res.error,
            error_code: res.code,
            message: res.message
        }, {
            status: 400,
            headers: { ...corsHeaders }
        })
    }

    const existingCustomer: Customer = res.customer
    const existingEndpoints = existingCustomer && existingCustomer.endpoints.length;

    if(!existingEndpoints) {
        return Response.json({
            error: true,
            error_code: 1003,
            message: "No endpoints exists for this customer"
        }, {
            status: 400,
            headers: { ...corsHeaders }
        });
    }

    const existingEndpoint = existingCustomer.endpoints.find(data => data.endpointId === endpointId);

    if (!existingEndpoint) {
        return Response.json({
            error: true,
            message: "Endpoint does not exist"
        }, {
            status: 400,
            headers: { ...corsHeaders }
        })
    }
    const updatedEndpointHeader = existingCustomer.endpoints.map(item => {
        if (item.endpointId === endpointId) {
            item.headers = body.headers
            return item
        } else {
            return item
        }
    });

    existingCustomer.endpoints = updatedEndpointHeader;

    await env.Customers.put(customerId, JSON.stringify(existingCustomer));

    return Response.json({ message: "Headers updated successfully", data: existingCustomer }, {
        status: 200,
        headers: { ...corsHeaders }
    });
}

export {
    getCustomHeadersCallback,
    saveCustomHeadersCallback
}