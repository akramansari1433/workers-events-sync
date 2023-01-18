import { Router } from "itty-router";
import { Env } from "./types";

import { getCustomerCallback, getCustomHeadersCallback, getEvents, getRequestDetails, getRetryconfigCallback, getUsersCallback, resendRequestCallback, saveCustomHeadersCallback, saveRetryConfigCallback, saveUsersCallback, syncCallback } from "./controller";
import { corsHeaders } from "./utils/constant";

const router = Router();

router.get("/users", getUsersCallback);

router.post("/users", saveUsersCallback);

// Main API to hit when event occurs
router.post("/api/sync", syncCallback);

// To get the retry config as per the customer
router.get("/headers/:customerId/:endpointId", getCustomHeadersCallback);

// To save custom headers
router.post("/headers/:customerId/:endpointId", saveCustomHeadersCallback);

// To get the retry config as per the customer
router.get("/retryconfig/:customerId/:endpointId", getRetryconfigCallback);

// To save retry config
router.post("/retryconfig/:customerId/:endpointId", saveRetryConfigCallback);

// To get all the events
router.get("/events", getEvents);

// To get request details
router.get("/events/:eventId/:requestId", getRequestDetails);

// Resend request
router.post("/request/resend/:customerId/:endpointId", resendRequestCallback);

// Get all customers
router.get("/customers", getCustomerCallback);

router.all(
    "*",
    () =>
        new Response("Not Found.", {
            status: 404,
            headers: { ...corsHeaders },
        })
);

export default router;
