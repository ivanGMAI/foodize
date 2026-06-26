import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.split("=");
    return [key, rest.join("=")];
  }),
);

const schemaPath = resolve(args.get("--schema") ?? "openapi/foodize.openapi.json");
const outputPath = resolve(args.get("--output") ?? "src/services/generated/client.ts");
const apiImport = args.get("--api-import") ?? "../api";

const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const methods = ["get", "post", "put", "patch", "delete"];

const toIdentifier = (value) => {
  const cleaned = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+(\w)/g, (_, letter) => letter.toUpperCase())
    .replace(/^\w/, (letter) => letter.toLowerCase());

  return /^[a-zA-Z_$]/.test(cleaned) ? cleaned : `operation${cleaned}`;
};

const fallbackOperationName = (method, path) =>
  toIdentifier(
    `${method} ${path
      .replace(/[{}]/g, "")
      .replace(/^\/api\/v1\/?/, "")
      .replace(/^\/+/, "")}`,
  );

const operations = [];
for (const [path, pathItem] of Object.entries(schema.paths ?? {})) {
  for (const method of methods) {
    const operation = pathItem?.[method];
    if (!operation) continue;

    operations.push({
      method,
      path,
      name: toIdentifier(operation.operationId ?? fallbackOperationName(method, path)),
    });
  }
}

const lines = [
  "/* eslint-disable */",
  "// This file is generated from OpenAPI. Do not edit by hand.",
  `import api from ${JSON.stringify(apiImport)};`,
  'import type { paths } from "./schema";',
  "",
  'type HttpMethod = "get" | "post" | "put" | "patch" | "delete";',
  "",
  "type JsonContent<T> = T extends { content: { \"application/json\": infer R } }",
  "  ? R",
  "  : never;",
  "",
  "type SuccessResponse<TOperation> = TOperation extends { responses: infer Responses }",
  "  ? JsonContent<",
  "      Responses extends { 200: infer R }",
  "        ? R",
  "        : Responses extends { 201: infer R }",
  "          ? R",
  "          : Responses extends { 202: infer R }",
  "            ? R",
  "            : Responses extends { 204: infer R }",
  "              ? R",
  "              : never",
  "    >",
  "  : never;",
  "",
  "type QueryParams<TOperation> = TOperation extends { parameters: { query?: infer Query } }",
  "  ? Query",
  "  : never;",
  "",
  "type PathParams<TOperation> = TOperation extends { parameters: { path?: infer Path } }",
  "  ? Path",
  "  : never;",
  "",
  "type RequestBody<TOperation> = TOperation extends {",
  "  requestBody?: { content: { \"application/json\": infer Body } };",
  "}",
  "  ? Body",
  "  : never;",
  "",
  "type RequestOptions<TOperation> = {",
  "  path?: PathParams<TOperation>;",
  "  query?: QueryParams<TOperation>;",
  "  body?: RequestBody<TOperation>;",
  "};",
  "",
  "function buildPath(pathTemplate: string, pathParams?: Record<string, unknown>) {",
  "  if (!pathParams) return pathTemplate;",
  "  return Object.entries(pathParams).reduce(",
  "    (path, [key, value]) => path.replace(`{${key}}`, encodeURIComponent(String(value))),",
  "    pathTemplate,",
  "  );",
  "}",
  "",
  "function getSchemaBaseUrl() {",
  "  const baseUrl = String(api.defaults.baseURL ?? \"\");",
  "  return baseUrl.replace(/\\/api\\/v1\\/?$/, \"\");",
  "}",
  "",
  "export async function request<TOperation>(",
  "  method: HttpMethod,",
  "  pathTemplate: string,",
  "  options: RequestOptions<TOperation> = {},",
  "): Promise<SuccessResponse<TOperation>> {",
  "  const response = await api.request({",
  "    baseURL: getSchemaBaseUrl(),",
  "    method,",
  "    url: buildPath(pathTemplate, options.path as Record<string, unknown> | undefined),",
  "    params: options.query,",
  "    data: options.body,",
  "  });",
  "  return response.data as SuccessResponse<TOperation>;",
  "}",
  "",
];

for (const operation of operations) {
  lines.push(
    `export const ${operation.name} = (options?: RequestOptions<paths[${JSON.stringify(operation.path)}][${JSON.stringify(operation.method)}]>) =>`,
    `  request<paths[${JSON.stringify(operation.path)}][${JSON.stringify(operation.method)}]>(${JSON.stringify(operation.method)}, ${JSON.stringify(operation.path)}, options);`,
    "",
  );
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, lines.join("\n"), "utf8");
console.log(`Generated ${operations.length} typed API operations in ${outputPath}`);
