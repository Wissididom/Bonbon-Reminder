FROM denoland/deno:2.1.5
WORKDIR /app
USER deno
COPY deno.json .
COPY deno.lock .
RUN deno install
COPY . .
RUN deno cache main.ts
CMD ["run", "-ERN", "main.ts"]
