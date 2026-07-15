/**
 * 'simple-cv' LaTeX template.
 *
 * A plainer, classic serif variant of the CV — no colors, centered header,
 * plain rules. Self-contained `article` class; mainstream packages only
 * (geometry, enumitem, hyperref, + ctex for zh). Compiles under XeLaTeX.
 *
 * Rendered with custom Mustache delimiters `<% %>`; values are pre-escaped.
 * Authored with `String.raw` so LaTeX backslashes survive verbatim.
 */
export const simpleCvTemplate = String.raw`\documentclass[11pt]{article}
\usepackage[margin=<% margin %>mm]{geometry}
\usepackage{enumitem}
\usepackage{hyperref}
<%# hasPhoto %>\usepackage{graphicx}
<%/ hasPhoto %>
<%# hasCjk %>\usepackage[UTF8]{ctex}
<%/ hasCjk %>\hypersetup{colorlinks=true,urlcolor=black,linkcolor=black}
\renewcommand{\familydefault}{\rmdefault}
\setlength{\parindent}{0pt}
\pagestyle{empty}

\newcommand{\cvsection}[1]{%
  \vspace{0.8em}%
  {\large\scshape #1}\par
  \vspace{0.1em}\hrule\vspace{0.5em}%
}

\begin{document}

\begin{center}
<%# hasPhoto %>\includegraphics[width=24mm,height=24mm,keepaspectratio]{<% photoFileName %>}\par\vspace{0.35em}
<%/ hasPhoto %>
{\huge\bfseries <% name %>}\par
<%# hasHeadline %>\vspace{0.25em}{<% headline %>}\par
<%/ hasHeadline %><%# hasContacts %>\vspace{0.35em}{\small <% contactsLine %>}\par
<%/ hasContacts %>\end{center}
<%# hasCustomFields %>\vspace{0.2em}{\small <%# customFields %><% label %>: <% value %>\quad <%/ customFields %>}\par
<%/ hasCustomFields %>
<%# sections %>\cvsection{<% title %>}
<%# isFreeform %><%# paragraphs %><% text %>\par\vspace{0.3em}
<%/ paragraphs %><%# hasBullets %>\begin{itemize}[nosep,leftmargin=1.2em]
<%# bullets %>  \item <% text %>
<%/ bullets %>\end{itemize}
<%/ hasBullets %><%/ isFreeform %><%^ isFreeform %><%# entries %>\textbf{<%# hasUrl %>\href{<% url %>}{<% primary %>}<%/ hasUrl %><%^ hasUrl %><% primary %><%/ hasUrl %>}<%# hasSecondary %>, <% secondary %><%/ hasSecondary %><%# hasDates %>\hfill {\small <% dates %>}<%/ hasDates %>\par
<%# hasLocation %>{\itshape <% location %>}\par
<%/ hasLocation %><%# hasTags %>{\small <% tags %>}\par
<%/ hasTags %><%# hasBullets %>\begin{itemize}[nosep,leftmargin=1.2em]
<%# bullets %>  \item <% text %>
<%/ bullets %>\end{itemize}
<%/ hasBullets %>\vspace{0.45em}
<%/ entries %><%/ isFreeform %><%/ sections %>
\end{document}
`;
