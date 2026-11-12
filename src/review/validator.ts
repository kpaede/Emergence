import {t as tr} from '../i18n';
import type {GraphSnapshot, Issue, Profile, Suggestion} from '../types';
import {findPath} from '../graph/registry';
import {safeProperty} from '../util';
import {needsTargetChoice} from './target-matches';

export function validateSuggestion(s: Suggestion, graph: GraphSnapshot, sourceContent: string, profile: Profile): Issue[] {
 const issues: Issue[] = [], block = (message: string) => issues.push({level: 'block', message});
 const source = graph.nodes.find(n => n.id === s.source), target = graph.nodes.find(n => n.id === s.target);
 const rule = graph.rules[s.field];
 const assignment = s.contract === 'breadcrumbs-v2';
 if (needsTargetChoice(s)) block(tr("common.select_an_existing_target_note"));
 const output = profile.outputs.find(o => o.id === s.outputId && o.enabled && o.kind === 'relations');
 if (!source?.exists || !s.target.endsWith('.md') || /[[\]#|\n\r\0\\]/u.test(s.target) || s.target.startsWith('/') || s.target.split('/').some(p => !p || p === '.' || p === '..')) block(tr("common.invalid_explicit_markdown_target_path"));
 if (s.targetKind === 'existing' && !target?.exists) block(tr("common.the_target_note_marked_as_existing_is_missing"));
 if (s.targetKind === 'unresolved') {
  if (target?.exists) block(tr("common.the_target_marked_as_new_already_exists_correct_the_target_type"));
  issues.push({level: 'warn', message: tr("common.target_not_created_yet_only_a_wiki_link_will_be_added")});
  const basename = s.target.split('/').at(-1)?.replace(/\.md$/u, '').toLocaleLowerCase();
  const similar = graph.nodes.filter(n => [n.title, ...n.aliases].some(v => v.toLocaleLowerCase() === basename));
  if (similar.length) issues.push({level: 'warn', message: tr("common.check_similar_existing_concepts", {value1: similar.map(n => n.id).join(', ')})});
 }
 if (!['existing', 'unresolved'].includes(s.targetKind)) block(tr("common.the_target_type_must_be_explicitly_defined"));
 if ((!rule && !assignment) || !graph.fields.includes(s.field)) block(tr("labels.unconfigured_edge_field"));
 if (assignment ? !rule?.description.trim() || rule.provenance !== 'user' || !rule.writable : !rule?.writable || rule.provenance !== 'user' || rule.class === 'unknown') block(tr("common.a_field_description_or_write_approval_is_missing_in_the_settings"));
 if (!safeProperty(s.property) || (!assignment && s.property !== rule?.targetProperty) || s.property !== s.field) block(tr("common.the_target_frontmatter_field_is_not_authorized"));
 if (s.operation !== 'add') block(tr("common.v1_only_writes_additions"));
 if (!output || output.writeMode !== 'review') block(tr("common.the_output_is_not_configured_for_writing_reviewed_changes"));
 if (output?.targetProperty && output.targetProperty !== s.property) block(tr("common.the_output_property_does_not_match"));
 if (output?.allowedEdgeTypes.length && !output.allowedEdgeTypes.includes(s.field)) block(tr("common.the_output_does_not_allow_this_relation_type"));
 if (output?.eligibleNodeTypes.length && (!target || !output.eligibleNodeTypes.includes(target.type))) block(tr("common.the_target_type_is_disallowed_or_not_yet_known_in_the"));
 if (rule?.eligibleNodeTypes.length && (!target || !rule.eligibleNodeTypes.includes(target.type))) block(tr("common.the_target_type_is_disallowed_or_not_yet_known_in_the_2"));
 if (s.target === s.source && !rule?.allowSelf) block(tr("common.self_reference_is_not_allowed"));
 if (!s.evidence.trim() || (assignment && s.evidenceSource === 'title' ? s.evidence !== source?.title : !sourceContent.includes(s.evidence))) block(tr("common.no_verifiable_source_location_in_the_note_title_or_source_text"));
 const confidence = {low: 0, medium: 1, high: 2};
 if (!assignment && output && confidence[s.confidence] < confidence[output.minEvidence]) block(tr("common.the_requested_qualitative_evidence_level_is_not_met_not_a_calibrated"));
 if (graph.edges.some(e => e.layer === 'breadcrumbs' && e.explicit && e.source === s.source && e.target === s.target && e.field === s.field)) block(tr("labels.an_identical_direct_relation_already_exists"));
 const path = findPath(graph, s.source, s.target, s.field);
 if (path && path.length > 2) issues.push({level: 'warn', message: rule?.transitive ? tr("common.already_transitively_reachable_review_the_need_for_an_additional_direct_relation") : tr("labels.an_alternative_path_exists_redundancy_is_not_assumed_automatically"), path});
 if (rule?.acyclic && findPath(graph, s.target, s.source, s.field)) block(tr("common.this_explicitly_acyclic_relation_would_create_a_cycle"));
 if (graph.partial) block(tr("common.the_graph_is_partial_full_link_resolution_is_required_before_writing"));
 return issues;
}
