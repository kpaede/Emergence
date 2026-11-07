import Ajv from 'ajv';
import {assert} from '../util';

export interface Assignment {field: string; target: string; evidence: string}
export interface AssignmentResponse {suggestions: Assignment[]}

/** Only assignments. The client resolves target IDs/titles and determines existing vs missing. */
export function assignmentSchema(fields: string[], targets: string[], evidence: string[], maxSuggestions: number, allowNew: boolean) {
 const enabled = fields.length && evidence.length && (targets.length || allowNew);
 return {type: 'object', additionalProperties: false, required: ['suggestions'], properties: {
  suggestions: enabled ? {type: 'array', maxItems: maxSuggestions, items: {
   type: 'object', additionalProperties: false, required: ['field', 'target', 'evidence'], properties: {
    field: {type: 'string', enum: fields},
    target: allowNew ? {type: 'string', minLength: 1, maxLength: 512} : {type: 'string', enum: targets},
    evidence: {type: 'string', enum: evidence},
   },
  }} : {type: 'array', maxItems: 0, items: false},
 }};
}
export function parseAssignments(text: string, schema: object): AssignmentResponse {
 const value: unknown = JSON.parse(text);
 const validate = new Ajv({strict: true, allErrors: true}).compile<AssignmentResponse>(schema);
 assert(validate(value), 'Antwort enthält ungültige Zuordnungen oder unerlaubte Zusatztexte.');
 return value;
}

/** One compact list per real frontmatter field, without repeated labels or model prose. */
export function fieldIdeasSchema(fields: string[], perField: number) {
 return {type: 'object', additionalProperties: false, required: fields, properties: Object.fromEntries(fields.map(field => [field,
  {type: 'array', maxItems: perField, uniqueItems: true, items: {type: 'string', minLength: 1, maxLength: 512}},
 ]))};
}
export function parseFieldIdeas(text: string, schema: ReturnType<typeof fieldIdeasSchema>): AssignmentResponse {
 const value: unknown = JSON.parse(text);
 const validate = new Ajv({strict: true, allErrors: true}).compile<Record<string, string[]>>(schema);
 assert(validate(value), 'Antwort enthält ungültige Feldideen oder unerlaubte Zusatztexte.');
 return {suggestions: Object.entries(value).flatMap(([field, targets]) => targets.map(target => ({field, target, evidence: 'T'})))};
}

/** Associations have no field until the user chooses a destination. */
export function associativeIdeasSchema(limit: number) {
 return {type: 'object', additionalProperties: false, required: ['ideas'], properties: {
  ideas: {type: 'array', maxItems: limit, uniqueItems: true, items: {type: 'string', minLength: 1, maxLength: 512}},
 }};
}
export function parseAssociativeIdeas(text: string, schema: object): AssignmentResponse {
 const value: unknown = JSON.parse(text);
 const validate = new Ajv({strict: true, allErrors: true}).compile<{ideas: string[]}>(schema);
 assert(validate(value), 'Antwort enthält ungültige Begriffe oder unerlaubte Feldzuordnungen.');
 return {suggestions: value.ideas.map(target => ({field: '', target, evidence: 'T'}))};
}
