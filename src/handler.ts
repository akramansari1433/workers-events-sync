import { Router } from "itty-router";

export const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Methods": "GET, PUT, POST,DELETE",
   "Access-Control-Max-Age": "86400",
   "Content-Type": "application/json",
};

const router = Router();

router.get("/users", async (request, env) => {
   let status;
   const url = "https://lingering-haze-67b1.star-lord.workers.dev/api/users";
   const fetchObject = {
      method: "GET",
      headers: {
         "Content-Type": "application/json",
      },
   };
   const response = await fetch(url, fetchObject).then((response) => {
      status = response.status;
      return response.json();
   });

   const data = await response;

   let key = Math.floor(Math.random() * 100 + 1);
   await env.EventsList.put(
      "ID" + key,
      JSON.stringify({
         key: "ID" + key,
         request: {
            url,
            ...fetchObject,
         },
         response: {
            status,
            response: data,
         },
      })
   );
   return Response.json(data, {
      headers: { ...corsHeaders },
   });
});

router.get("/events", async (request, env) => {
   const keys: any[] = (await env.EventsList.list()).keys;
   const values: any[] = await Promise.all(
      keys.map(async (key) => await env.EventsList.get(key.name))
   );

   const data = values.map((value) => JSON.parse(value));

   return Response.json(data, {
      headers: { ...corsHeaders },
   });
});

router.get("/events/:id", async (request, env) => {
   const { id } = request.params;
   const data = await env.EventsList.get(id);
   return Response.json(data ? JSON.parse(data) : {}, {
      headers: { ...corsHeaders },
   });
});

router.post("/users", async (request, env) => {
   const body = await request.json();
   let status;
   const url = "https://lingering-haze-67b1.star-lord.workers.dev/api/users";
   const fetchObject = {
      method: "POST",
      headers: {
         "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
   };
   const response = await fetch(url, fetchObject).then((response) => {
      status = response.status;
      return response.json();
   });

   const data = await response;
   let key = Math.floor(Math.random() * 100 + 1);
   await env.EventsList.put(
      "ID" + key,
      JSON.stringify({
         key: "ID" + key,
         request: {
            url,
            ...fetchObject,
            body: JSON.parse(fetchObject.body),
         },
         response: {
            status,
            response: data,
         },
      })
   );

   return Response.json(data, {
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
