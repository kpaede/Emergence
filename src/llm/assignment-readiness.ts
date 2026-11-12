import {t as tr} from '../i18n';
import type {GraphSnapshot, Settings, Profile} from '../types';

export interface AssignmentBlocker {kind: 'note' | 'fields' | 'descriptions' | 'filter' | 'profile'; message: string; fields?: string[]}
export function assignmentReadiness(source: string, fields: string[], graph: GraphSnapshot, settings: Settings, profile: Profile): AssignmentBlocker[] {
 const issues: AssignmentBlocker[] = [];
 if (!source.endsWith('.md')) issues.push({kind: 'note', message: tr("fieldIdeas.open_a_markdown_note_in_the_main_workspace_first")});
 if (!fields.length) issues.push({kind: 'fields', message: tr("fieldIdeas.this_note_s_frontmatter_has_no_configured_breadcrumbs_field_add_a")});
 const output = profile.outputs.find(o => o.enabled && o.kind === 'relations');
 if (!output || output.maxSuggestions === 0) issues.push({kind: 'profile', message: tr("fieldIdeas.enable_relation_suggestions_with_at_least_one_result_in_the_analysis")});
 const usable = fields.filter(field => !output?.allowedEdgeTypes.length || output.allowedEdgeTypes.includes(field));
 if (fields.length && !usable.length) issues.push({kind: 'profile', message: tr("fieldIdeas.the_analysis_profile_does_not_allow_any_of_the_selected_fields")});
 const missing = usable.filter(field => !graph.rules[field]?.description.trim());
 if (missing.length) issues.push({kind: 'descriptions', message: tr("fieldIdeas.field_description_not_saved_yet", {value1: missing.join(', ')}), fields: missing});
 if (settings.assignment.propertyFilter === 'custom' && !settings.assignment.properties.length) issues.push({kind: 'filter', message: tr("fieldIdeas.enter_at_least_one_frontmatter_key_for_the_target_filter_and")});
 return issues;
}
