import { IRequest } from "itty-router";
import { getCustomerDetails } from "../helper";
import { Env, Keys } from "../types";
import { corsHeaders } from "../utils/constant";

export const getCustomerCallback = async (request: IRequest, env: Env) => {
    const customerDetails = await getCustomerDetails(env)
    if (customerDetails) {
        return Response.json(customerDetails, {
            headers: { ...corsHeaders }
        });
    } else {
        return Response.json({
            error: true,
            message: "Could not find customer list"
        }, {
            status: 500,
            headers: { ...corsHeaders }
        })
    }
}