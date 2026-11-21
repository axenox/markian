/** Portable Mermaid templates and literal source fragments for the block workspace. */
interface Snippet {
  label: string;
  code: string;
}
interface SnippetGroup {
  label: string;
  snippets: readonly Snippet[];
}
interface Diagram {
  id: string;
  label: string;
  template: string;
  groups: readonly SnippetGroup[];
}

const comments: SnippetGroup = { label: 'MERMAID.NOTES', snippets: [{ label: 'MERMAID.COMMENT', code: '%% Add a note here' }] };
const flowShapes: SnippetGroup = { label: 'MERMAID.SHAPES', snippets: [
  { label: 'MERMAID.RECTANGLE', code: 'A[Label]' },
  { label: 'MERMAID.ROUNDED_BOX', code: 'A(Label)' },
  { label: 'MERMAID.DECISION', code: 'A{Question}' },
  { label: 'MERMAID.CIRCLE', code: 'A((Label))' },
  { label: 'MERMAID.DATABASE', code: 'A[(Database)]' },
] };
const flowLines: SnippetGroup = { label: 'MERMAID.LINES_AND_ARROWS', snippets: [
  { label: 'MERMAID.ARROW', code: 'A --> B' },
  { label: 'MERMAID.LINE', code: 'A --- B' },
  { label: 'MERMAID.DOTTED_ARROW', code: 'A -.-> B' },
  { label: 'MERMAID.LABELED_ARROW', code: 'A -->|Label| B' },
] };
const flowColors: SnippetGroup = { label: 'MERMAID.CUSTOM_COLORS', snippets: [
  { label: 'MERMAID.SHAPE_COLOR', code: 'style A fill:#dbeafe,stroke:#2563eb,color:#172554' },
  { label: 'MERMAID.REUSABLE_COLOR', code: 'classDef accent fill:#dbeafe,stroke:#2563eb,color:#172554\nclass A accent' },
  { label: 'MERMAID.LINE_COLOR', code: 'linkStyle 0 stroke:#2563eb' },
] };

export const diagrams: readonly Diagram[] = [
  { id: 'class', label: 'MERMAID.TYPE_CLASS', template: 'classDiagram\n  class Animal {\n    +String name\n    +speak()\n  }\n  class Dog\n  Animal <|-- Dog', groups: [
    { label: 'MERMAID.CLASSES', snippets: [
      { label: 'MERMAID.CLASS', code: 'class Animal {\n  +String name\n  +speak()\n}' },
      { label: 'MERMAID.ATTRIBUTE', code: '+String name' },
      { label: 'MERMAID.METHOD', code: '+speak()' },
    ] },
    { label: 'MERMAID.LINES_AND_ARROWS', snippets: [
      { label: 'MERMAID.INHERITANCE', code: 'Animal <|-- Dog' },
      { label: 'MERMAID.ASSOCIATION', code: 'Animal --> Owner : belongs to' },
      { label: 'MERMAID.COMPOSITION', code: 'Animal *-- Heart' },
      { label: 'MERMAID.AGGREGATION', code: 'Group o-- Animal' },
      { label: 'MERMAID.DEPENDENCY', code: 'Animal ..> Food' },
    ] },
    { label: 'MERMAID.NOTES', snippets: [{ label: 'MERMAID.CLASS_NOTE', code: 'note for Animal "Add a note"' }, ...comments.snippets] },
    { label: 'MERMAID.CUSTOM_COLORS', snippets: [
      { label: 'MERMAID.CLASS_COLOR', code: 'style Animal fill:#dbeafe,stroke:#2563eb,color:#172554' },
    ] },
  ] },
  { id: 'flowchart', label: 'MERMAID.TYPE_FLOWCHART', template: 'flowchart LR\n  A[Start] --> B{Ready?}\n  B -->|Yes| C[Finish]\n  B -->|No| A', groups: [
    flowShapes, flowLines,
    { label: 'MERMAID.NOTES', snippets: [{ label: 'MERMAID.VISIBLE_NOTE', code: 'N["Add a note"]\nA -.- N' }, ...comments.snippets] },
    flowColors,
  ] },
  { id: 'sequence', label: 'MERMAID.TYPE_SEQUENCE', template: 'sequenceDiagram\n  participant User\n  participant System\n  User->>System: Request\n  System-->>User: Response', groups: [
    { label: 'MERMAID.PARTICIPANTS', snippets: [
      { label: 'MERMAID.PARTICIPANT', code: 'participant System' },
      { label: 'MERMAID.ACTOR', code: 'actor User' },
    ] },
    { label: 'MERMAID.LINES_AND_ARROWS', snippets: [
      { label: 'MERMAID.MESSAGE', code: 'User->>System: Request' },
      { label: 'MERMAID.REPLY', code: 'System-->>User: Response' },
      { label: 'MERMAID.OPEN_ARROW', code: 'User-)System: Event' },
      { label: 'MERMAID.ACTIVATION', code: 'activate System\nSystem-->>User: Response\ndeactivate System' },
    ] },
    { label: 'MERMAID.NOTES', snippets: [
      { label: 'MERMAID.NOTE_BESIDE', code: 'Note right of System: Add a note' },
      { label: 'MERMAID.NOTE_OVER', code: 'Note over User,System: Add a note' },
      ...comments.snippets,
    ] },
    { label: 'MERMAID.CUSTOM_COLORS', snippets: [
      { label: 'MERMAID.HIGHLIGHT_REGION', code: 'rect rgb(219, 234, 254)\nUser->>System: Request\nend' },
    ] },
  ] },
  { id: 'state', label: 'MERMAID.TYPE_STATE', template: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Active : Start\n  Active --> Idle : Stop\n  Active --> [*]', groups: [
    { label: 'MERMAID.STATES', snippets: [
      { label: 'MERMAID.STATE', code: 'state "Display label" as Idle' },
      { label: 'MERMAID.COMPOSITE_STATE', code: 'state Active {\n  [*] --> Running\n}' },
      { label: 'MERMAID.CHOICE', code: 'state Choice <<choice>>' },
    ] },
    { label: 'MERMAID.LINES_AND_ARROWS', snippets: [
      { label: 'MERMAID.TRANSITION', code: 'Idle --> Active : Start' },
      { label: 'MERMAID.START', code: '[*] --> Idle' },
      { label: 'MERMAID.FINISH', code: 'Active --> [*]' },
    ] },
    { label: 'MERMAID.NOTES', snippets: [{ label: 'MERMAID.STATE_NOTE', code: 'note right of Idle: Add a note' }, ...comments.snippets] },
    { label: 'MERMAID.CUSTOM_COLORS', snippets: [
      { label: 'MERMAID.STATE_COLOR', code: 'classDef accent fill:#dbeafe,stroke:#2563eb,color:#172554\nclass Idle accent' },
    ] },
  ] },
  { id: 'usecase', label: 'MERMAID.TYPE_USECASE', template: 'flowchart LR\n  %% Markian use case\n  Actor[User]\n  subgraph System\n    UseCase([Use case])\n  end\n  Actor --- UseCase', groups: [
    { label: 'MERMAID.ACTORS_AND_USE_CASES', snippets: [
      { label: 'MERMAID.ACTOR', code: 'Actor[User]' },
      { label: 'MERMAID.USE_CASE', code: 'UseCase([Use case])' },
      { label: 'MERMAID.SYSTEM_BOUNDARY', code: 'subgraph System\n  UseCase([Use case])\nend' },
    ] },
    { label: 'MERMAID.LINES_AND_ARROWS', snippets: [
      { label: 'MERMAID.ASSOCIATION', code: 'Actor --- UseCase' },
      { label: 'MERMAID.INCLUDE', code: 'UseCase -.->|include| OtherCase' },
      { label: 'MERMAID.EXTEND', code: 'OtherCase -.->|extend| UseCase' },
    ] },
    { label: 'MERMAID.NOTES', snippets: [{ label: 'MERMAID.VISIBLE_NOTE', code: 'N["Add a note"]\nUseCase -.- N' }, ...comments.snippets] },
    { label: 'MERMAID.CUSTOM_COLORS', snippets: [{ label: 'MERMAID.USE_CASE_COLOR', code: 'style UseCase fill:#dbeafe,stroke:#2563eb,color:#172554' }] },
  ] },
  { id: 'erd', label: 'MERMAID.TYPE_ERD', template: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  CUSTOMER {\n    int id PK\n    string name\n  }\n  ORDER {\n    int id PK\n    int customerId FK\n  }', groups: [
    { label: 'MERMAID.ENTITIES', snippets: [
      { label: 'MERMAID.ENTITY', code: 'CUSTOMER {\n  int id PK\n  string name\n}' },
      { label: 'MERMAID.PRIMARY_KEY', code: 'int id PK' },
      { label: 'MERMAID.FOREIGN_KEY', code: 'int customerId FK' },
      { label: 'MERMAID.ATTRIBUTE', code: 'string name' },
    ] },
    { label: 'MERMAID.RELATIONSHIPS', snippets: [
      { label: 'MERMAID.ONE_TO_MANY', code: 'CUSTOMER ||--o{ ORDER : places' },
      { label: 'MERMAID.ONE_TO_ONE', code: 'CUSTOMER ||--|| PROFILE : has' },
      { label: 'MERMAID.MANY_TO_MANY', code: 'ORDER }o--o{ PRODUCT : contains' },
    ] },
    comments,
    { label: 'MERMAID.CUSTOM_COLORS', snippets: [
      { label: 'MERMAID.ENTITY_COLOR', code: 'style CUSTOMER fill:#dbeafe,stroke:#2563eb,color:#172554' },
    ] },
  ] },
  { id: 'git', label: 'MERMAID.TYPE_GIT', template: 'gitGraph\n  commit\n  branch feature\n  checkout feature\n  commit\n  checkout main\n  merge feature', groups: [
    { label: 'MERMAID.COMMITS_AND_BRANCHES', snippets: [
      { label: 'MERMAID.COMMIT', code: 'commit' },
      { label: 'MERMAID.NAMED_COMMIT', code: 'commit id: "Change"' },
      { label: 'MERMAID.BRANCH', code: 'branch feature' },
      { label: 'MERMAID.CHECKOUT', code: 'checkout main' },
      { label: 'MERMAID.MERGE', code: 'merge feature' },
      { label: 'MERMAID.TAG', code: 'commit tag: "v1.0"' },
    ] },
    comments,
  ] },
];

/** Reads the declaration, leaving unsupported or unfinished source untouched. */
export function diagramFor(source: string): Diagram | undefined {
  const declaration = source.split(/\r?\n/).find(line => line.trim() && !line.trimStart().startsWith('%%'))?.trim() ?? '';
  let id: string | undefined;
  if (/^(?:flowchart|graph)\b/.test(declaration)) id = /^\s*%% Markian use case\s*$/m.test(source) ? 'usecase' : 'flowchart';
  else if (/^classDiagram\b/.test(declaration)) id = 'class';
  else if (/^sequenceDiagram\b/.test(declaration)) id = 'sequence';
  else if (/^stateDiagram(?:-v2)?\b/.test(declaration)) id = 'state';
  else if (/^erDiagram\b/.test(declaration)) id = 'erd';
  else if (/^gitGraph\b/.test(declaration)) id = 'git';
  return diagrams.find(diagram => diagram.id === id);
}

export const genericSnippets: readonly SnippetGroup[] = [comments];
