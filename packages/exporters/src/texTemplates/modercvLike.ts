/**
 * 'moderncv-like' LaTeX template.
 *
 * A self-contained `article`-class document (does NOT require moderncv.cls).
 * Uses only mainstream packages: geometry, xcolor, enumitem, hyperref, and
 * ctex (only for zh content). Compiles under XeLaTeX.
 *
 * Mustache is rendered with custom delimiters `<% %>` so LaTeX braces do not
 * collide with `{{ }}`. Values are pre-escaped by the view model, so Mustache
 * HTML escaping is disabled at render time.
 *
 * Authored with `String.raw` so backslash escapes (`\usepackage`, ...) survive
 * the template literal verbatim.
 */
export const modercvLikeTemplate = String.raw`\documentclass[10pt]{article}
\usepackage[margin=<% margin %>mm]{geometry}
\usepackage{xcolor}
\usepackage{enumitem}
\usepackage{hyperref}
<%# hasPhoto %>\usepackage{graphicx}
<%/ hasPhoto %>
<%# hasCjk %>\usepackage[UTF8]{ctex}
<%/ hasCjk %>\definecolor{cvaccent}{HTML}{2F5C8F}
\hypersetup{colorlinks=true,urlcolor=cvaccent,linkcolor=cvaccent}
\setlength{\parindent}{0pt}
\pagestyle{empty}

\newcommand{\cvsection}[1]{%
  \vspace{0.9em}%
  {\color{cvaccent}\large\bfseries #1}\par
  \vspace{0.15em}%
  {\color{cvaccent}\rule{\linewidth}{0.9pt}}\par
  \vspace{0.5em}%
}

\begin{document}

<%# hasPhoto %>\begin{minipage}[t]{0.78\linewidth}
<%/ hasPhoto %>{\Huge\bfseries <% name %>}\par
<%# hasHeadline %>\vspace{0.25em}{\large <% headline %>}\par
<%/ hasHeadline %><%# hasContacts %>\vspace{0.4em}{\small <% contactsLine %>}\par
<%/ hasContacts %><%# hasCustomFields %>\vspace{0.2em}{\small <%# customFields %><% label %>: <% value %>\quad <%/ customFields %>}\par
<%/ hasCustomFields %>
<%# hasPhoto %>\end{minipage}\hfill
\begin{minipage}[t]{0.16\linewidth}\raggedleft
\includegraphics[width=\linewidth,height=28mm,keepaspectratio]{<% photoFileName %>}
\end{minipage}\par
<%/ hasPhoto %>
<%# sections %>\cvsection{<% title %>}
<%# isFreeform %><%# paragraphs %><% text %>\par\vspace{0.3em}
<%/ paragraphs %><%# hasBullets %>\begin{itemize}[nosep,leftmargin=1.2em]
<%# bullets %>  \item <% text %>
<%/ bullets %>\end{itemize}
<%/ hasBullets %><%/ isFreeform %><%^ isFreeform %><%# entries %>\noindent\begin{minipage}{\linewidth}
{\bfseries <%# hasUrl %>\href{<% url %>}{<% primary %>}<%/ hasUrl %><%^ hasUrl %><% primary %><%/ hasUrl %>}<%# hasSecondary %> \textnormal{--- <% secondary %>}<%/ hasSecondary %><%# hasDates %>\hfill {\small <% dates %>}<%/ hasDates %>\par
<%# hasLocation %>{\small\itshape <% location %>}\par
<%/ hasLocation %><%# hasTags %>{\small <% tags %>}\par
<%/ hasTags %>\end{minipage}\par
<%# hasBullets %>\begin{itemize}[nosep,leftmargin=1.2em]
<%# bullets %>  \item <% text %>
<%/ bullets %>\end{itemize}
<%/ hasBullets %>\vspace{0.5em}
<%/ entries %><%/ isFreeform %><%/ sections %>
\end{document}
`;
