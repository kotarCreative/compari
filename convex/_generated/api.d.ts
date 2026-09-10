/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adapters_agentMail from "../adapters/agentMail.js";
import type * as adapters_firecrawl from "../adapters/firecrawl.js";
import type * as adapters_openai from "../adapters/openai.js";
import type * as adapters_ranking from "../adapters/ranking.js";
import type * as adapters_reasoning from "../adapters/reasoning.js";
import type * as adapters_runtime from "../adapters/runtime.js";
import type * as agentMail from "../agentMail.js";
import type * as agentMailJobs from "../agentMailJobs.js";
import type * as auth from "../auth.js";
import type * as conversations from "../conversations.js";
import type * as demo from "../demo.js";
import type * as demoActions from "../demoActions.js";
import type * as demoJobs from "../demoJobs.js";
import type * as diagnostics from "../diagnostics.js";
import type * as domain_decision from "../domain/decision.js";
import type * as domain_demo from "../domain/demo.js";
import type * as domain_followUpPolicy from "../domain/followUpPolicy.js";
import type * as domain_inboxProvisioning from "../domain/inboxProvisioning.js";
import type * as domain_outboundPolicy from "../domain/outboundPolicy.js";
import type * as domain_ranking from "../domain/ranking.js";
import type * as domain_rankingSelection from "../domain/rankingSelection.js";
import type * as domain_reasoning from "../domain/reasoning.js";
import type * as domain_researchEndpoints from "../domain/researchEndpoints.js";
import type * as domain_sideEffectPolicy from "../domain/sideEffectPolicy.js";
import type * as domain_webhook from "../domain/webhook.js";
import type * as domain_workflowState from "../domain/workflowState.js";
import type * as evaluations from "../evaluations.js";
import type * as evaluationsWorkflow from "../evaluationsWorkflow.js";
import type * as followUpJobs from "../followUpJobs.js";
import type * as followUps from "../followUps.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as outreach from "../outreach.js";
import type * as outreachWorkflow from "../outreachWorkflow.js";
import type * as outreachWorkflowState from "../outreachWorkflowState.js";
import type * as ports_agentMail from "../ports/agentMail.js";
import type * as ports_ranking from "../ports/ranking.js";
import type * as ports_reasoning from "../ports/reasoning.js";
import type * as ports_webResearch from "../ports/webResearch.js";
import type * as proposals from "../proposals.js";
import type * as questions from "../questions.js";
import type * as rankingState from "../rankingState.js";
import type * as rankingWorkflow from "../rankingWorkflow.js";
import type * as reasoningJobs from "../reasoningJobs.js";
import type * as reasoningWorkflow from "../reasoningWorkflow.js";
import type * as requestDetails from "../requestDetails.js";
import type * as requests from "../requests.js";
import type * as requirements from "../requirements.js";
import type * as selections from "../selections.js";
import type * as sideEffectJobs from "../sideEffectJobs.js";
import type * as users from "../users.js";
import type * as webhookEvents from "../webhookEvents.js";
import type * as webhookProcessor from "../webhookProcessor.js";
import type * as workflowState from "../workflowState.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "adapters/agentMail": typeof adapters_agentMail;
  "adapters/firecrawl": typeof adapters_firecrawl;
  "adapters/openai": typeof adapters_openai;
  "adapters/ranking": typeof adapters_ranking;
  "adapters/reasoning": typeof adapters_reasoning;
  "adapters/runtime": typeof adapters_runtime;
  agentMail: typeof agentMail;
  agentMailJobs: typeof agentMailJobs;
  auth: typeof auth;
  conversations: typeof conversations;
  demo: typeof demo;
  demoActions: typeof demoActions;
  demoJobs: typeof demoJobs;
  diagnostics: typeof diagnostics;
  "domain/decision": typeof domain_decision;
  "domain/demo": typeof domain_demo;
  "domain/followUpPolicy": typeof domain_followUpPolicy;
  "domain/inboxProvisioning": typeof domain_inboxProvisioning;
  "domain/outboundPolicy": typeof domain_outboundPolicy;
  "domain/ranking": typeof domain_ranking;
  "domain/rankingSelection": typeof domain_rankingSelection;
  "domain/reasoning": typeof domain_reasoning;
  "domain/researchEndpoints": typeof domain_researchEndpoints;
  "domain/sideEffectPolicy": typeof domain_sideEffectPolicy;
  "domain/webhook": typeof domain_webhook;
  "domain/workflowState": typeof domain_workflowState;
  evaluations: typeof evaluations;
  evaluationsWorkflow: typeof evaluationsWorkflow;
  followUpJobs: typeof followUpJobs;
  followUps: typeof followUps;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  outreach: typeof outreach;
  outreachWorkflow: typeof outreachWorkflow;
  outreachWorkflowState: typeof outreachWorkflowState;
  "ports/agentMail": typeof ports_agentMail;
  "ports/ranking": typeof ports_ranking;
  "ports/reasoning": typeof ports_reasoning;
  "ports/webResearch": typeof ports_webResearch;
  proposals: typeof proposals;
  questions: typeof questions;
  rankingState: typeof rankingState;
  rankingWorkflow: typeof rankingWorkflow;
  reasoningJobs: typeof reasoningJobs;
  reasoningWorkflow: typeof reasoningWorkflow;
  requestDetails: typeof requestDetails;
  requests: typeof requests;
  requirements: typeof requirements;
  selections: typeof selections;
  sideEffectJobs: typeof sideEffectJobs;
  users: typeof users;
  webhookEvents: typeof webhookEvents;
  webhookProcessor: typeof webhookProcessor;
  workflowState: typeof workflowState;
  workflows: typeof workflows;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
