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

const comments: SnippetGroup = { label: 'Notes', snippets: [{ label: 'Comment', code: '%% Add a note here' }] };
const flowShapes: SnippetGroup = { label: 'Shapes', snippets: [
  { label: 'Rectangle', code: 'A[Label]' },
  { label: 'Rounded box', code: 'A(Label)' },
  { label: 'Decision', code: 'A{Question}' },
  { label: 'Circle', code: 'A((Label))' },
  { label: 'Database', code: 'A[(Database)]' },
] };
const flowLines: SnippetGroup = { label: 'Lines and arrows', snippets: [
  { label: 'Arrow', code: 'A --> B' },
  { label: 'Line', code: 'A --- B' },
  { label: 'Dotted arrow', code: 'A -.-> B' },
  { label: 'Labeled arrow', code: 'A -->|Label| B' },
] };
const flowColors: SnippetGroup = { label: 'Custom colors', snippets: [
  { label: 'Shape color', code: 'style A fill:#dbeafe,stroke:#2563eb,color:#172554' },
  { label: 'Reusable color', code: 'classDef accent fill:#dbeafe,stroke:#2563eb,color:#172554\nclass A accent' },
  { label: 'Line color', code: 'linkStyle 0 stroke:#2563eb' },
] };

export const diagrams: readonly Diagram[] = [
  { id: 'class', label: 'Class', template: 'classDiagram\n  class Animal {\n    +String name\n    +speak()\n  }\n  class Dog\n  Animal <|-- Dog', groups: [
    { label: 'Classes', snippets: [
      { label: 'Class', code: 'class Animal {\n  +String name\n  +speak()\n}' },
      { label: 'Attribute', code: '+String name' },
      { label: 'Method', code: '+speak()' },
    ] },
    { label: 'Lines and arrows', snippets: [
      { label: 'Inheritance', code: 'Animal <|-- Dog' },
      { label: 'Association', code: 'Animal --> Owner : belongs to' },
      { label: 'Composition', code: 'Animal *-- Heart' },
      { label: 'Aggregation', code: 'Group o-- Animal' },
      { label: 'Dependency', code: 'Animal ..> Food' },
    ] },
    { label: 'Notes', snippets: [{ label: 'Class note', code: 'note for Animal "Add a note"' }, ...comments.snippets] },
    { label: 'Custom colors', snippets: [
      { label: 'Class color', code: 'style Animal fill:#dbeafe,stroke:#2563eb,color:#172554' },
    ] },
  ] },
  { id: 'flowchart', label: 'Flowchart', template: 'flowchart LR\n  A[Start] --> B{Ready?}\n  B -->|Yes| C[Finish]\n  B -->|No| A', groups: [
    flowShapes, flowLines,
    { label: 'Notes', snippets: [{ label: 'Visible note', code: 'N["Add a note"]\nA -.- N' }, ...comments.snippets] },
    flowColors,
  ] },
  { id: 'sequence', label: 'Sequence', template: 'sequenceDiagram\n  participant User\n  participant System\n  User->>System: Request\n  System-->>User: Response', groups: [
    { label: 'Participants', snippets: [
      { label: 'Participant', code: 'participant System' },
      { label: 'Actor', code: 'actor User' },
    ] },
    { label: 'Lines and arrows', snippets: [
      { label: 'Message', code: 'User->>System: Request' },
      { label: 'Reply', code: 'System-->>User: Response' },
      { label: 'Open arrow', code: 'User-)System: Event' },
      { label: 'Activation', code: 'activate System\nSystem-->>User: Response\ndeactivate System' },
    ] },
    { label: 'Notes', snippets: [
      { label: 'Note beside', code: 'Note right of System: Add a note' },
      { label: 'Note over', code: 'Note over User,System: Add a note' },
      ...comments.snippets,
    ] },
    { label: 'Custom colors', snippets: [
      { label: 'Highlight region', code: 'rect rgb(219, 234, 254)\nUser->>System: Request\nend' },
    ] },
  ] },
  { id: 'state', label: 'State', template: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Active : Start\n  Active --> Idle : Stop\n  Active --> [*]', groups: [
    { label: 'States', snippets: [
      { label: 'State', code: 'state "Display label" as Idle' },
      { label: 'Composite state', code: 'state Active {\n  [*] --> Running\n}' },
      { label: 'Choice', code: 'state Choice <<choice>>' },
    ] },
    { label: 'Lines and arrows', snippets: [
      { label: 'Transition', code: 'Idle --> Active : Start' },
      { label: 'Start', code: '[*] --> Idle' },
      { label: 'Finish', code: 'Active --> [*]' },
    ] },
    { label: 'Notes', snippets: [{ label: 'State note', code: 'note right of Idle: Add a note' }, ...comments.snippets] },
    { label: 'Custom colors', snippets: [
      { label: 'State color', code: 'classDef accent fill:#dbeafe,stroke:#2563eb,color:#172554\nclass Idle accent' },
    ] },
  ] },
  { id: 'usecase', label: 'Use case', template: 'flowchart LR\n  %% Markian use case\n  Actor[User]\n  subgraph System\n    UseCase([Use case])\n  end\n  Actor --- UseCase', groups: [
    { label: 'Actors and use cases', snippets: [
      { label: 'Actor', code: 'Actor[User]' },
      { label: 'Use case', code: 'UseCase([Use case])' },
      { label: 'System boundary', code: 'subgraph System\n  UseCase([Use case])\nend' },
    ] },
    { label: 'Lines and arrows', snippets: [
      { label: 'Association', code: 'Actor --- UseCase' },
      { label: 'Include', code: 'UseCase -.->|include| OtherCase' },
      { label: 'Extend', code: 'OtherCase -.->|extend| UseCase' },
    ] },
    { label: 'Notes', snippets: [{ label: 'Visible note', code: 'N["Add a note"]\nUseCase -.- N' }, ...comments.snippets] },
    { label: 'Custom colors', snippets: [{ label: 'Use-case color', code: 'style UseCase fill:#dbeafe,stroke:#2563eb,color:#172554' }] },
  ] },
  { id: 'erd', label: 'ERD', template: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  CUSTOMER {\n    int id PK\n    string name\n  }\n  ORDER {\n    int id PK\n    int customerId FK\n  }', groups: [
    { label: 'Entities', snippets: [
      { label: 'Entity', code: 'CUSTOMER {\n  int id PK\n  string name\n}' },
      { label: 'Primary key', code: 'int id PK' },
      { label: 'Foreign key', code: 'int customerId FK' },
      { label: 'Attribute', code: 'string name' },
    ] },
    { label: 'Relationships', snippets: [
      { label: 'One to many', code: 'CUSTOMER ||--o{ ORDER : places' },
      { label: 'One to one', code: 'CUSTOMER ||--|| PROFILE : has' },
      { label: 'Many to many', code: 'ORDER }o--o{ PRODUCT : contains' },
    ] },
    comments,
    { label: 'Custom colors', snippets: [
      { label: 'Entity color', code: 'style CUSTOMER fill:#dbeafe,stroke:#2563eb,color:#172554' },
    ] },
  ] },
  { id: 'git', label: 'Git graph', template: 'gitGraph\n  commit\n  branch feature\n  checkout feature\n  commit\n  checkout main\n  merge feature', groups: [
    { label: 'Commits and branches', snippets: [
      { label: 'Commit', code: 'commit' },
      { label: 'Named commit', code: 'commit id: "Change"' },
      { label: 'Branch', code: 'branch feature' },
      { label: 'Checkout', code: 'checkout main' },
      { label: 'Merge', code: 'merge feature' },
      { label: 'Tag', code: 'commit tag: "v1.0"' },
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
