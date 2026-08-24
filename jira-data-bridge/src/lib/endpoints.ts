// Catalog of Jira REST API read (GET) endpoints for the API Explorer.
//
// Paths under the core API use the literal token {apiVersion}; the caller
// substitutes 3 (Cloud) or 2 (Server/Data Center). Jira Software (Agile)
// endpoints use the fixed prefix /rest/agile/1.0.
//
// Every {placeholder} other than {apiVersion} has a matching pathParams entry.

export interface EndpointParam {
  name: string
  example?: string
  description?: string
}

export interface JiraEndpoint {
  id: string
  group: string
  label: string
  path: string
  description: string
  pathParams?: EndpointParam[]
  queryParams?: EndpointParam[]
  cloudOnly?: boolean
  serverOnly?: boolean
}

const G = {
  self: 'Self & session',
  server: 'Server & instance',
  projects: 'Projects',
  issues: 'Issues',
  search: 'Search (JQL)',
  users: 'Users & groups',
  metadata: 'Metadata & fields',
  filters: 'Filters & dashboards',
  permissions: 'Permissions & security',
  workflows: 'Workflows & screens',
  versions: 'Versions & components',
  agile: 'Agile (Jira Software)',
  misc: 'Audit & misc',
} as const

export const ENDPOINT_GROUPS: string[] = [
  G.self,
  G.server,
  G.projects,
  G.issues,
  G.search,
  G.users,
  G.metadata,
  G.filters,
  G.permissions,
  G.workflows,
  G.versions,
  G.agile,
  G.misc,
]

export const JIRA_ENDPOINTS: JiraEndpoint[] = [
  // ── Self & session ────────────────────────────────────────────────────────
  {
    id: 'get-myself',
    group: G.self,
    label: 'Current user',
    path: '/rest/api/{apiVersion}/myself',
    description: 'Returns details for the authenticated user.',
    queryParams: [
      { name: 'expand', example: 'groups,applicationRoles', description: 'Extra user details to include' },
    ],
  },
  {
    id: 'get-my-permissions',
    group: G.self,
    label: 'My permissions',
    path: '/rest/api/{apiVersion}/mypermissions',
    description: 'Returns which permissions the current user has, optionally in a project or issue context.',
    queryParams: [
      { name: 'permissions', example: 'BROWSE_PROJECTS,EDIT_ISSUES', description: 'Comma-separated permission keys (required on Cloud)' },
      { name: 'projectKey', example: 'PROJ', description: 'Check permissions within this project' },
      { name: 'issueKey', example: 'PROJ-123', description: 'Check permissions within this issue' },
    ],
  },
  {
    id: 'get-my-preferences',
    group: G.self,
    label: 'My preference',
    path: '/rest/api/{apiVersion}/mypreferences',
    description: 'Returns the value of a personal preference for the current user.',
    queryParams: [
      { name: 'key', example: 'jira.user.locale', description: 'Preference key to fetch' },
    ],
  },

  // ── Server & instance ─────────────────────────────────────────────────────
  {
    id: 'get-server-info',
    group: G.server,
    label: 'Server info',
    path: '/rest/api/{apiVersion}/serverInfo',
    description: 'Returns Jira version, build number, base URL, and server time.',
  },
  {
    id: 'get-configuration',
    group: G.server,
    label: 'Global configuration',
    path: '/rest/api/{apiVersion}/configuration',
    description: 'Returns global settings such as voting, watching, time tracking, and attachments.',
  },
  {
    id: 'list-application-roles',
    group: G.server,
    label: 'Application roles',
    path: '/rest/api/{apiVersion}/applicationrole',
    description: 'Returns all application roles and their groups (admin permission required).',
  },
  {
    id: 'get-instance-license',
    group: G.server,
    label: 'Instance license',
    path: '/rest/api/{apiVersion}/instance/license',
    description: 'Returns licensing details for the Cloud instance.',
    cloudOnly: true,
  },

  // ── Projects ──────────────────────────────────────────────────────────────
  {
    id: 'search-projects',
    group: G.projects,
    label: 'Search projects (paginated)',
    path: '/rest/api/{apiVersion}/project/search',
    description: 'Returns a paginated list of projects visible to the user.',
    cloudOnly: true,
    queryParams: [
      { name: 'query', example: 'website', description: 'Filter by project name or key' },
      { name: 'expand', example: 'description,lead,insight', description: 'Extra project details to include' },
      { name: 'orderBy', example: 'name', description: 'Sort field, e.g. name, key, lastIssueUpdatedTime' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'list-projects',
    group: G.projects,
    label: 'All projects (full list)',
    path: '/rest/api/{apiVersion}/project',
    description: 'Returns all visible projects in one response; the standard listing on Server/DC, deprecated on Cloud.',
    queryParams: [
      { name: 'expand', example: 'description,lead', description: 'Extra project details to include' },
      { name: 'recent', example: '5', description: 'Return only the N most recently accessed projects' },
    ],
  },
  {
    id: 'get-project',
    group: G.projects,
    label: 'Project details',
    path: '/rest/api/{apiVersion}/project/{projectIdOrKey}',
    description: 'Returns full details of a single project.',
    pathParams: [
      { name: 'projectIdOrKey', example: 'PROJ', description: 'Project key or numeric ID' },
    ],
    queryParams: [
      { name: 'expand', example: 'description,lead,issueTypes', description: 'Extra project details to include' },
    ],
  },
  {
    id: 'get-project-components',
    group: G.projects,
    label: 'Project components',
    path: '/rest/api/{apiVersion}/project/{projectIdOrKey}/components',
    description: 'Returns all components of a project.',
    pathParams: [
      { name: 'projectIdOrKey', example: 'PROJ', description: 'Project key or numeric ID' },
    ],
  },
  {
    id: 'get-project-versions',
    group: G.projects,
    label: 'Project versions',
    path: '/rest/api/{apiVersion}/project/{projectIdOrKey}/versions',
    description: 'Returns all versions (releases) of a project.',
    pathParams: [
      { name: 'projectIdOrKey', example: 'PROJ', description: 'Project key or numeric ID' },
    ],
    queryParams: [
      { name: 'expand', example: 'operations', description: 'Extra version details to include' },
    ],
  },
  {
    id: 'get-project-statuses',
    group: G.projects,
    label: 'Project statuses',
    path: '/rest/api/{apiVersion}/project/{projectIdOrKey}/statuses',
    description: 'Returns the valid statuses per issue type for a project.',
    pathParams: [
      { name: 'projectIdOrKey', example: 'PROJ', description: 'Project key or numeric ID' },
    ],
  },
  {
    id: 'get-project-roles',
    group: G.projects,
    label: 'Project roles',
    path: '/rest/api/{apiVersion}/project/{projectIdOrKey}/role',
    description: 'Returns the project roles and links to their member details.',
    pathParams: [
      { name: 'projectIdOrKey', example: 'PROJ', description: 'Project key or numeric ID' },
    ],
  },
  {
    id: 'get-project-role-actors',
    group: G.projects,
    label: 'Project role members',
    path: '/rest/api/{apiVersion}/project/{projectIdOrKey}/role/{id}',
    description: 'Returns the users and groups assigned to one project role (its actors).',
    pathParams: [
      { name: 'projectIdOrKey', example: 'PROJ', description: 'Project key or numeric ID' },
      { name: 'id', example: '10002', description: 'Project role ID (from Project roles)' },
    ],
  },
  {
    id: 'get-project-properties',
    group: G.projects,
    label: 'Project property keys',
    path: '/rest/api/{apiVersion}/project/{projectIdOrKey}/properties',
    description: 'Returns the keys of all entity properties stored on a project.',
    pathParams: [
      { name: 'projectIdOrKey', example: 'PROJ', description: 'Project key or numeric ID' },
    ],
  },
  {
    id: 'list-project-categories',
    group: G.projects,
    label: 'Project categories',
    path: '/rest/api/{apiVersion}/projectCategory',
    description: 'Returns all project categories.',
  },

  // ── Issues ────────────────────────────────────────────────────────────────
  {
    id: 'get-issue',
    group: G.issues,
    label: 'Issue details',
    path: '/rest/api/{apiVersion}/issue/{issueIdOrKey}',
    description: 'Returns the full details of a single issue.',
    pathParams: [
      { name: 'issueIdOrKey', example: 'PROJ-123', description: 'Issue key or numeric ID' },
    ],
    queryParams: [
      { name: 'fields', example: 'summary,status,assignee', description: 'Comma-separated fields to return (default: all)' },
      { name: 'expand', example: 'changelog,renderedFields', description: 'Extra data, e.g. changelog, transitions, names' },
    ],
  },
  {
    id: 'get-issue-comments',
    group: G.issues,
    label: 'Issue comments',
    path: '/rest/api/{apiVersion}/issue/{issueIdOrKey}/comment',
    description: 'Returns the comments on an issue, paginated.',
    pathParams: [
      { name: 'issueIdOrKey', example: 'PROJ-123', description: 'Issue key or numeric ID' },
    ],
    queryParams: [
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
      { name: 'orderBy', example: '-created', description: 'Sort by created date; prefix - for newest first' },
    ],
  },
  {
    id: 'get-issue-worklogs',
    group: G.issues,
    label: 'Issue worklogs',
    path: '/rest/api/{apiVersion}/issue/{issueIdOrKey}/worklog',
    description: 'Returns the worklog entries recorded on an issue.',
    pathParams: [
      { name: 'issueIdOrKey', example: 'PROJ-123', description: 'Issue key or numeric ID' },
    ],
    queryParams: [
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'get-worklogs-updated',
    group: G.issues,
    label: 'Worklogs updated since',
    path: '/rest/api/{apiVersion}/worklog/updated',
    description: 'Returns IDs of worklogs updated after a timestamp — the primitive for incremental worklog sync.',
    queryParams: [
      { name: 'since', example: '1698796800000', description: 'Epoch milliseconds; worklogs updated at or after this time' },
    ],
  },
  {
    id: 'get-issue-transitions',
    group: G.issues,
    label: 'Issue transitions',
    path: '/rest/api/{apiVersion}/issue/{issueIdOrKey}/transitions',
    description: 'Returns the workflow transitions currently available on an issue.',
    pathParams: [
      { name: 'issueIdOrKey', example: 'PROJ-123', description: 'Issue key or numeric ID' },
    ],
    queryParams: [
      { name: 'expand', example: 'transitions.fields', description: 'Include the fields editable during each transition' },
    ],
  },
  {
    id: 'get-issue-changelog',
    group: G.issues,
    label: 'Issue changelog',
    path: '/rest/api/{apiVersion}/issue/{issueIdOrKey}/changelog',
    description: 'Returns the change history of an issue, paginated (on Server/DC use expand=changelog on the issue instead).',
    cloudOnly: true,
    pathParams: [
      { name: 'issueIdOrKey', example: 'PROJ-123', description: 'Issue key or numeric ID' },
    ],
    queryParams: [
      { name: 'maxResults', example: '100', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'get-issue-watchers',
    group: G.issues,
    label: 'Issue watchers',
    path: '/rest/api/{apiVersion}/issue/{issueIdOrKey}/watchers',
    description: 'Returns the users watching an issue.',
    pathParams: [
      { name: 'issueIdOrKey', example: 'PROJ-123', description: 'Issue key or numeric ID' },
    ],
  },
  {
    id: 'get-issue-votes',
    group: G.issues,
    label: 'Issue votes',
    path: '/rest/api/{apiVersion}/issue/{issueIdOrKey}/votes',
    description: 'Returns the vote count and voters for an issue.',
    pathParams: [
      { name: 'issueIdOrKey', example: 'PROJ-123', description: 'Issue key or numeric ID' },
    ],
  },
  {
    id: 'get-issue-remote-links',
    group: G.issues,
    label: 'Issue remote links',
    path: '/rest/api/{apiVersion}/issue/{issueIdOrKey}/remotelink',
    description: 'Returns the remote (web/app) links attached to an issue.',
    pathParams: [
      { name: 'issueIdOrKey', example: 'PROJ-123', description: 'Issue key or numeric ID' },
    ],
    queryParams: [
      { name: 'globalId', example: 'system=https://example.com&id=1', description: 'Return only the link with this global ID' },
    ],
  },
  {
    id: 'get-issue-edit-meta',
    group: G.issues,
    label: 'Issue edit metadata',
    path: '/rest/api/{apiVersion}/issue/{issueIdOrKey}/editmeta',
    description: 'Returns the fields that can be edited on an issue and their allowed values.',
    pathParams: [
      { name: 'issueIdOrKey', example: 'PROJ-123', description: 'Issue key or numeric ID' },
    ],
  },
  {
    id: 'get-issue-properties',
    group: G.issues,
    label: 'Issue property keys',
    path: '/rest/api/{apiVersion}/issue/{issueIdOrKey}/properties',
    description: 'Returns the keys of all entity properties stored on an issue.',
    pathParams: [
      { name: 'issueIdOrKey', example: 'PROJ-123', description: 'Issue key or numeric ID' },
    ],
  },
  {
    id: 'get-create-meta',
    group: G.issues,
    label: 'Issue create metadata',
    path: '/rest/api/{apiVersion}/issue/createmeta',
    description: 'Returns projects, issue types, and fields available at issue creation; deprecated on Cloud and removed in Jira DC 9+.',
    queryParams: [
      { name: 'projectKeys', example: 'PROJ', description: 'Comma-separated project keys to include' },
      { name: 'issuetypeNames', example: 'Bug', description: 'Comma-separated issue type names to include' },
      { name: 'expand', example: 'projects.issuetypes.fields', description: 'Include per-field metadata' },
    ],
  },
  {
    id: 'get-createmeta-issuetypes',
    group: G.issues,
    label: 'Create metadata: issue types',
    path: '/rest/api/{apiVersion}/issue/createmeta/{projectIdOrKey}/issuetypes',
    description: 'Returns the issue types creatable in a project — the createmeta replacement on Cloud and Jira DC 9+.',
    pathParams: [
      { name: 'projectIdOrKey', example: 'PROJ', description: 'Project key or numeric ID' },
    ],
    queryParams: [
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'get-createmeta-fields',
    group: G.issues,
    label: 'Create metadata: fields',
    path: '/rest/api/{apiVersion}/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}',
    description: 'Returns the creatable fields for one issue type in a project (createmeta replacement).',
    pathParams: [
      { name: 'projectIdOrKey', example: 'PROJ', description: 'Project key or numeric ID' },
      { name: 'issueTypeId', example: '10001', description: 'Numeric issue type ID' },
    ],
    queryParams: [
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'issue-picker',
    group: G.issues,
    label: 'Issue picker suggestions',
    path: '/rest/api/{apiVersion}/issue/picker',
    description: 'Returns issue suggestions matching a text query, as used by Jira issue pickers.',
    queryParams: [
      { name: 'query', example: 'login bug', description: 'Text matched against summary and key' },
      { name: 'currentJQL', example: 'project = PROJ', description: 'JQL restricting the suggestion pool' },
    ],
  },

  // ── Search (JQL) ──────────────────────────────────────────────────────────
  {
    id: 'search-jql',
    group: G.search,
    label: 'Search issues (enhanced JQL)',
    path: '/rest/api/{apiVersion}/search/jql',
    description: 'Returns issues matching a JQL query using token-based pagination.',
    cloudOnly: true,
    queryParams: [
      { name: 'jql', example: 'project = PROJ ORDER BY created DESC', description: 'JQL query' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'fields', example: 'summary,status,assignee', description: 'Comma-separated fields to return' },
      { name: 'nextPageToken', example: 'CAEaAggD', description: 'Token from the previous page of results' },
    ],
  },
  {
    id: 'search-classic',
    group: G.search,
    label: 'Search issues (classic)',
    path: '/rest/api/{apiVersion}/search',
    description: 'Classic offset-paginated JQL search; Server/DC only — Cloud removed this endpoint in 2025 in favour of /search/jql.',
    serverOnly: true,
    queryParams: [
      { name: 'jql', example: 'project = PROJ ORDER BY created DESC', description: 'JQL query' },
      { name: 'startAt', example: '0', description: 'Page offset' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'fields', example: 'summary,status,assignee', description: 'Comma-separated fields to return' },
    ],
  },
  {
    id: 'jql-autocomplete-data',
    group: G.search,
    label: 'JQL autocomplete data',
    path: '/rest/api/{apiVersion}/jql/autocompletedata',
    description: 'Returns the reference data (fields, functions, operators) used for JQL autocompletion.',
  },
  {
    id: 'jql-autocomplete-suggestions',
    group: G.search,
    label: 'JQL field value suggestions',
    path: '/rest/api/{apiVersion}/jql/autocompletedata/suggestions',
    description: 'Returns autocomplete suggestions for a JQL field value.',
    queryParams: [
      { name: 'fieldName', example: 'status', description: 'JQL field to suggest values for' },
      { name: 'fieldValue', example: 'In', description: 'Partial value to match' },
    ],
  },

  // ── Users & groups ────────────────────────────────────────────────────────
  {
    id: 'get-user',
    group: G.users,
    label: 'User details',
    path: '/rest/api/{apiVersion}/user',
    description: 'Returns details of a user identified by account ID (Cloud) or username (Server/DC).',
    queryParams: [
      { name: 'accountId', example: '5b10ac8d82e05b22cc7d4ef5', description: 'Cloud: the user account ID' },
      { name: 'username', example: 'jsmith', description: 'Server/DC: the username' },
      { name: 'expand', example: 'groups,applicationRoles', description: 'Extra user details to include' },
    ],
  },
  {
    id: 'find-users',
    group: G.users,
    label: 'Search users',
    path: '/rest/api/{apiVersion}/user/search',
    description: 'Returns users matching a search string.',
    queryParams: [
      { name: 'query', example: 'john', description: 'Cloud: matches display name and email' },
      { name: 'username', example: 'jsmith', description: 'Server/DC: matches username, name, and email' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'find-assignable-users',
    group: G.users,
    label: 'Assignable users',
    path: '/rest/api/{apiVersion}/user/assignable/search',
    description: 'Returns users that can be assigned to issues in a project or a specific issue.',
    queryParams: [
      { name: 'project', example: 'PROJ', description: 'Project key to check assignability against' },
      { name: 'issueKey', example: 'PROJ-123', description: 'Issue key to check assignability against' },
      { name: 'query', example: 'john', description: 'Cloud: search string for the user' },
      { name: 'username', example: 'jsmith', description: 'Server/DC: search string for the user' },
      { name: 'maxResults', example: '50', description: 'Page size' },
    ],
  },
  {
    id: 'list-all-users',
    group: G.users,
    label: 'All users',
    path: '/rest/api/{apiVersion}/users/search',
    description: 'Returns a paginated list of all users, including inactive ones.',
    cloudOnly: true,
    queryParams: [
      { name: 'startAt', example: '0', description: 'Page offset' },
      { name: 'maxResults', example: '50', description: 'Page size' },
    ],
  },
  {
    id: 'get-group-members',
    group: G.users,
    label: 'Group members',
    path: '/rest/api/{apiVersion}/group/member',
    description: 'Returns a paginated list of the users in a group.',
    queryParams: [
      { name: 'groupname', example: 'jira-software-users', description: 'Group name (works on both platforms)' },
      { name: 'groupId', example: '276f955c-63d7-42c8-9520-92d01dca0625', description: 'Cloud only: group ID' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'find-groups',
    group: G.users,
    label: 'Group picker',
    path: '/rest/api/{apiVersion}/groups/picker',
    description: 'Returns groups matching a search string, as shown in group pickers.',
    queryParams: [
      { name: 'query', example: 'jira', description: 'Text matched against group names' },
      { name: 'maxResults', example: '20', description: 'Maximum groups to return' },
    ],
  },
  {
    id: 'find-users-and-groups',
    group: G.users,
    label: 'User & group picker',
    path: '/rest/api/{apiVersion}/groupuserpicker',
    description: 'Returns users and groups matching one query, as used by combined assignee/mention pickers.',
    queryParams: [
      { name: 'query', example: 'ada', description: 'Text matched against user and group names' },
      { name: 'maxResults', example: '20', description: 'Maximum results per category' },
      { name: 'projectId', example: '10000', description: 'Restrict user results to a project' },
    ],
  },

  // ── Metadata & fields ─────────────────────────────────────────────────────
  {
    id: 'list-fields',
    group: G.metadata,
    label: 'All fields',
    path: '/rest/api/{apiVersion}/field',
    description: 'Returns all system and custom fields with their IDs and schema.',
  },
  {
    id: 'list-issue-types',
    group: G.metadata,
    label: 'Issue types',
    path: '/rest/api/{apiVersion}/issuetype',
    description: 'Returns all issue types visible to the user.',
  },
  {
    id: 'list-priorities',
    group: G.metadata,
    label: 'Priorities',
    path: '/rest/api/{apiVersion}/priority',
    description: 'Returns all issue priorities.',
  },
  {
    id: 'list-resolutions',
    group: G.metadata,
    label: 'Resolutions',
    path: '/rest/api/{apiVersion}/resolution',
    description: 'Returns all issue resolutions.',
  },
  {
    id: 'list-statuses',
    group: G.metadata,
    label: 'Statuses',
    path: '/rest/api/{apiVersion}/status',
    description: 'Returns all workflow statuses.',
  },
  {
    id: 'list-status-categories',
    group: G.metadata,
    label: 'Status categories',
    path: '/rest/api/{apiVersion}/statuscategory',
    description: 'Returns the status categories (To Do, In Progress, Done).',
  },
  {
    id: 'list-labels',
    group: G.metadata,
    label: 'Labels',
    path: '/rest/api/{apiVersion}/label',
    description: 'Returns a paginated list of all issue labels.',
    cloudOnly: true,
    queryParams: [
      { name: 'startAt', example: '0', description: 'Page offset' },
      { name: 'maxResults', example: '100', description: 'Page size' },
    ],
  },
  {
    id: 'list-issue-link-types',
    group: G.metadata,
    label: 'Issue link types',
    path: '/rest/api/{apiVersion}/issueLinkType',
    description: 'Returns all issue link types (e.g. blocks, duplicates).',
  },
  {
    id: 'get-custom-field-option',
    group: G.metadata,
    label: 'Custom field option',
    path: '/rest/api/{apiVersion}/customFieldOption/{id}',
    description: 'Returns the value of a single custom field option by its ID.',
    pathParams: [
      { name: 'id', example: '10107', description: 'Custom field option ID' },
    ],
  },

  // ── Filters & dashboards ──────────────────────────────────────────────────
  {
    id: 'search-filters',
    group: G.filters,
    label: 'Search filters',
    path: '/rest/api/{apiVersion}/filter/search',
    description: 'Returns a paginated list of filters matching the criteria.',
    cloudOnly: true,
    queryParams: [
      { name: 'filterName', example: 'My open bugs', description: 'Filter by name' },
      { name: 'expand', example: 'jql,owner', description: 'Extra filter details to include' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'get-favourite-filters',
    group: G.filters,
    label: 'Favourite filters',
    path: '/rest/api/{apiVersion}/filter/favourite',
    description: "Returns the current user's favourite filters.",
    queryParams: [
      { name: 'expand', example: 'jql,owner', description: 'Extra filter details to include' },
    ],
  },
  {
    id: 'get-filter',
    group: G.filters,
    label: 'Filter details',
    path: '/rest/api/{apiVersion}/filter/{id}',
    description: 'Returns a single filter, including its JQL.',
    pathParams: [
      { name: 'id', example: '10042', description: 'Filter ID' },
    ],
    queryParams: [
      { name: 'expand', example: 'jql,owner,viewUrl', description: 'Extra filter details to include' },
    ],
  },
  {
    id: 'list-dashboards',
    group: G.filters,
    label: 'Dashboards',
    path: '/rest/api/{apiVersion}/dashboard',
    description: 'Returns a paginated list of dashboards visible to the user.',
    queryParams: [
      { name: 'filter', example: 'favourite', description: 'Restrict to favourite or my dashboards' },
      { name: 'maxResults', example: '20', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'get-dashboard',
    group: G.filters,
    label: 'Dashboard details',
    path: '/rest/api/{apiVersion}/dashboard/{id}',
    description: 'Returns a single dashboard.',
    pathParams: [
      { name: 'id', example: '10100', description: 'Dashboard ID' },
    ],
  },

  // ── Permissions & security ────────────────────────────────────────────────
  {
    id: 'list-permissions',
    group: G.permissions,
    label: 'All permissions',
    path: '/rest/api/{apiVersion}/permissions',
    description: 'Returns all global and project permissions defined in the instance.',
  },
  {
    id: 'list-permission-schemes',
    group: G.permissions,
    label: 'Permission schemes',
    path: '/rest/api/{apiVersion}/permissionscheme',
    description: 'Returns all permission schemes.',
    queryParams: [
      { name: 'expand', example: 'permissions,user,group', description: 'Extra scheme details to include' },
    ],
  },
  {
    id: 'list-issue-security-schemes',
    group: G.permissions,
    label: 'Issue security schemes',
    path: '/rest/api/{apiVersion}/issuesecurityschemes',
    description: 'Returns all issue security schemes (admin permission required).',
  },
  {
    id: 'list-notification-schemes',
    group: G.permissions,
    label: 'Notification schemes',
    path: '/rest/api/{apiVersion}/notificationscheme',
    description: 'Returns the notification schemes and who gets notified for each event.',
    queryParams: [
      { name: 'expand', example: 'notificationSchemeEvents', description: 'Include per-event notification recipients' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },

  // ── Workflows & screens ───────────────────────────────────────────────────
  {
    id: 'search-workflows',
    group: G.workflows,
    label: 'Search workflows',
    path: '/rest/api/{apiVersion}/workflow/search',
    description: 'Returns a paginated list of workflows.',
    cloudOnly: true,
    queryParams: [
      { name: 'workflowName', example: 'Software Simplified Workflow', description: 'Filter by workflow name' },
      { name: 'expand', example: 'transitions,statuses', description: 'Extra workflow details to include' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'list-workflows',
    group: G.workflows,
    label: 'All workflows',
    path: '/rest/api/{apiVersion}/workflow',
    description: 'Returns all workflows on the instance; Server/DC only (Cloud uses Search workflows).',
    serverOnly: true,
    queryParams: [
      { name: 'workflowName', example: 'jira', description: 'Filter by workflow name' },
    ],
  },
  {
    id: 'get-workflow-scheme',
    group: G.workflows,
    label: 'Workflow scheme',
    path: '/rest/api/{apiVersion}/workflowscheme/{id}',
    description: 'Returns a workflow scheme and its issue type to workflow mappings.',
    pathParams: [
      { name: 'id', example: '10000', description: 'Workflow scheme ID' },
    ],
  },
  {
    id: 'list-screens',
    group: G.workflows,
    label: 'Screens',
    path: '/rest/api/{apiVersion}/screens',
    description: 'Returns all screens (admin permission required).',
    queryParams: [
      { name: 'maxResults', example: '100', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'get-status',
    group: G.workflows,
    label: 'Status details',
    path: '/rest/api/{apiVersion}/status/{idOrName}',
    description: 'Returns a single workflow status by ID or name.',
    pathParams: [
      { name: 'idOrName', example: '10001', description: 'Status ID or name, e.g. 10001 or In Progress' },
    ],
  },

  // ── Versions & components ─────────────────────────────────────────────────
  {
    id: 'get-version',
    group: G.versions,
    label: 'Version details',
    path: '/rest/api/{apiVersion}/version/{id}',
    description: 'Returns a single project version (release).',
    pathParams: [
      { name: 'id', example: '10200', description: 'Version ID' },
    ],
    queryParams: [
      { name: 'expand', example: 'operations,issuesstatus', description: 'Extra version details, e.g. issue counts by status' },
    ],
  },
  {
    id: 'get-version-related-issue-counts',
    group: G.versions,
    label: 'Version issue counts',
    path: '/rest/api/{apiVersion}/version/{id}/relatedIssueCounts',
    description: 'Returns how many issues use this version as fix version or affected version.',
    pathParams: [
      { name: 'id', example: '10200', description: 'Version ID' },
    ],
  },
  {
    id: 'get-component',
    group: G.versions,
    label: 'Component details',
    path: '/rest/api/{apiVersion}/component/{id}',
    description: 'Returns a single project component.',
    pathParams: [
      { name: 'id', example: '10050', description: 'Component ID' },
    ],
  },

  // ── Agile (Jira Software) ─────────────────────────────────────────────────
  {
    id: 'list-boards',
    group: G.agile,
    label: 'Boards',
    path: '/rest/agile/1.0/board',
    description: 'Returns a paginated list of boards visible to the user.',
    queryParams: [
      { name: 'type', example: 'scrum', description: 'Board type: scrum, kanban, or simple' },
      { name: 'name', example: 'Team Alpha', description: 'Filter by board name' },
      { name: 'projectKeyOrId', example: 'PROJ', description: 'Only boards for this project' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'get-board',
    group: G.agile,
    label: 'Board details',
    path: '/rest/agile/1.0/board/{boardId}',
    description: 'Returns a single board.',
    pathParams: [
      { name: 'boardId', example: '42', description: 'Board ID' },
    ],
  },
  {
    id: 'get-board-configuration',
    group: G.agile,
    label: 'Board configuration',
    path: '/rest/agile/1.0/board/{boardId}/configuration',
    description: 'Returns the board configuration: columns, filter, estimation, and ranking.',
    pathParams: [
      { name: 'boardId', example: '42', description: 'Board ID' },
    ],
  },
  {
    id: 'get-board-backlog',
    group: G.agile,
    label: 'Board backlog',
    path: '/rest/agile/1.0/board/{boardId}/backlog',
    description: 'Returns the issues in the backlog of a board.',
    pathParams: [
      { name: 'boardId', example: '42', description: 'Board ID' },
    ],
    queryParams: [
      { name: 'jql', example: 'priority = High', description: 'Additional JQL to narrow the backlog' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'list-board-issues',
    group: G.agile,
    label: 'Board issues',
    path: '/rest/agile/1.0/board/{boardId}/issue',
    description: 'Returns all issues on a board, across backlog and sprints.',
    pathParams: [
      { name: 'boardId', example: '42', description: 'Board ID' },
    ],
    queryParams: [
      { name: 'jql', example: 'status != Done', description: 'Additional JQL to narrow the issues' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'list-board-sprints',
    group: G.agile,
    label: 'Board sprints',
    path: '/rest/agile/1.0/board/{boardId}/sprint',
    description: 'Returns the sprints associated with a board.',
    pathParams: [
      { name: 'boardId', example: '42', description: 'Board ID' },
    ],
    queryParams: [
      { name: 'state', example: 'active', description: 'Filter by sprint state: future, active, closed' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'list-board-epics',
    group: G.agile,
    label: 'Board epics',
    path: '/rest/agile/1.0/board/{boardId}/epic',
    description: 'Returns the epics associated with a board.',
    pathParams: [
      { name: 'boardId', example: '42', description: 'Board ID' },
    ],
    queryParams: [
      { name: 'done', example: 'false', description: 'Filter by whether the epic is done' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'get-sprint',
    group: G.agile,
    label: 'Sprint details',
    path: '/rest/agile/1.0/sprint/{sprintId}',
    description: 'Returns a single sprint, including its state and dates.',
    pathParams: [
      { name: 'sprintId', example: '7', description: 'Sprint ID' },
    ],
  },
  {
    id: 'list-sprint-issues',
    group: G.agile,
    label: 'Sprint issues',
    path: '/rest/agile/1.0/sprint/{sprintId}/issue',
    description: 'Returns the issues in a sprint.',
    pathParams: [
      { name: 'sprintId', example: '7', description: 'Sprint ID' },
    ],
    queryParams: [
      { name: 'jql', example: 'status != Done', description: 'Additional JQL to narrow the issues' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'get-epic',
    group: G.agile,
    label: 'Epic details',
    path: '/rest/agile/1.0/epic/{epicIdOrKey}',
    description: 'Returns a single epic.',
    pathParams: [
      { name: 'epicIdOrKey', example: 'PROJ-100', description: 'Epic issue key or ID' },
    ],
  },
  {
    id: 'list-epic-issues',
    group: G.agile,
    label: 'Epic issues',
    path: '/rest/agile/1.0/epic/{epicIdOrKey}/issue',
    description: 'Returns the issues belonging to an epic.',
    pathParams: [
      { name: 'epicIdOrKey', example: 'PROJ-100', description: 'Epic issue key or ID' },
    ],
    queryParams: [
      { name: 'jql', example: 'status != Done', description: 'Additional JQL to narrow the issues' },
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },

  // ── Audit & misc ──────────────────────────────────────────────────────────
  {
    id: 'get-audit-records',
    group: G.misc,
    label: 'Audit records',
    path: '/rest/api/{apiVersion}/auditing/record',
    description: 'Returns audit log records (admin permission required).',
    queryParams: [
      { name: 'filter', example: 'project', description: 'Text filter across audit record fields' },
      { name: 'from', example: '2026-01-01T00:00:00.000Z', description: 'Only records created after this timestamp' },
      { name: 'to', example: '2026-06-30T23:59:59.000Z', description: 'Only records created before this timestamp' },
      { name: 'limit', example: '100', description: 'Maximum records to return' },
    ],
  },
  {
    id: 'get-attachment',
    group: G.misc,
    label: 'Attachment metadata',
    path: '/rest/api/{apiVersion}/attachment/{id}',
    description: 'Returns the metadata (name, size, author, content URL) of an attachment.',
    pathParams: [
      { name: 'id', example: '10010', description: 'Attachment ID' },
    ],
  },
  {
    id: 'list-system-avatars',
    group: G.misc,
    label: 'System avatars',
    path: '/rest/api/{apiVersion}/avatar/{type}/system',
    description: 'Returns the built-in system avatars of a given type.',
    pathParams: [
      { name: 'type', example: 'project', description: 'Avatar type: project, issuetype, or user' },
    ],
  },
  {
    id: 'list-webhooks',
    group: G.misc,
    label: 'Registered webhooks',
    path: '/rest/api/{apiVersion}/webhook',
    description: 'Returns the dynamic webhooks registered by the calling app (OAuth app credentials required).',
    cloudOnly: true,
    queryParams: [
      { name: 'maxResults', example: '50', description: 'Page size' },
      { name: 'startAt', example: '0', description: 'Page offset' },
    ],
  },
  {
    id: 'list-events',
    group: G.misc,
    label: 'Issue events',
    path: '/rest/api/{apiVersion}/events',
    description: 'Returns all issue event types (created, updated, resolved, etc.).',
  },
  {
    id: 'list-roles',
    group: G.misc,
    label: 'All project roles',
    path: '/rest/api/{apiVersion}/role',
    description: 'Returns all project roles defined in the instance (admin permission required).',
  },
]
