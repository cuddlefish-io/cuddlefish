import { BorderBox, Box, Flex, Grid } from "@primer/components";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { graphql, useMutation } from "react-relay/hooks";
import SyntaxHighlighter from "react-syntax-highlighter";
import createElement from "react-syntax-highlighter/dist/esm/create-element";
import { githubGist } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { githubRepoId, internalError } from "./App";
import Comments from "./Comments";

const MyPreTag: React.FC = (props) => (
  <table
    style={{
      // This max-content is the magic sauce that prevents word wrapping.
      minWidth: "max-content",
      // border-spacing unset is essential otherwise there's mystery space added between rows.
      borderSpacing: "unset",
      // So that indents, etc actually show up.
      whiteSpace: "pre",
    }}
    className="codetable"
  >
    {props.children}
  </table>
);

// Returns whether or not the blameline info has been successfully calculated and dumped into the blamelines table.
function useCalcBlameLines(
  repo_owner: string,
  repo_name: string,
  filePath: string,
  commitSHA: string
) {
  const repoId = githubRepoId(repo_owner, repo_name);
  const [calcBlameLines, waiting] = useMutation(graphql`
    mutation CodeAndComments_calcblamelines_Mutation(
      $repoId: String!
      $commit: String!
      $filePath: String!
    ) {
      CalculateBlameLines(
        repoId: $repoId
        lastCommit: $commit
        filePath: $filePath
      )
    }
  `);
  useEffect(() => {
    calcBlameLines({
      variables: { repoId, commit: commitSHA, filePath: filePath },
      onError: internalError,
    });
    // TODO: Having calcBlameLines in here actually causes a bunch of redundant calls to the API for the same file. This
    // really sucks. I'm guessing that the RelayEnvProvider reloads too many times and that each time implies a new
    // calcBlameLines closure.
  }, [repoId, commitSHA, filePath, calcBlameLines]);

  return !waiting;
}

function useFileContents(
  repo_owner: string,
  repo_name: string,
  commitSHA: string,
  filePath: string
) {
  const [fileContents, setFileContents] = useState(null as null | string);
  useEffect(() => {
    (async () => {
      try {
        const fileResponse = await fetch(
          `https://raw.githubusercontent.com/${repo_owner}/${repo_name}/${commitSHA}/${filePath}`
        );
        setFileContents(await fileResponse.text());
      } catch (error) {
        // TODO: 404 when the file/repo doesn't exist or it's just not public.
        console.error(error);
      }
    })();
  }, [repo_owner, repo_name, commitSHA, filePath]);
  return fileContents;
}

const CodeAndComments: React.FC<{
  repo_owner: string;
  repo_name: string;
  filePath: string;
  commitSHA: string;
}> = ({ repo_owner, repo_name, filePath, commitSHA }) => {
  const fileContents = useFileContents(
    repo_owner,
    repo_name,
    commitSHA,
    filePath
  );
  const blameDone = useCalcBlameLines(
    repo_owner,
    repo_name,
    filePath,
    commitSHA
  );

  // // Check that we have the same number of `blamelines` as we have lines in the `fileContents`.
  // // If there are trailing newlines at the end of the file, git blame will remove just the last one. Luckily git blame
  // // does not interfere with newlines at the beginning of a file howevere.
  // if (fileContents.endsWith("\n")) {
  //   console.assert(
  //     fileContents.slice(0, -1).split(/\r?\n/).length ===
  //       blamelines.BlameLines.length
  //   );
  // } else {
  //   console.assert(
  //     fileContents.split(/\r?\n/).length === blamelines.BlameLines.length
  //   );
  // }

  // Collapsing this into a single state unfortunately doesn't work because that would require re-rendering the
  // SyntaxHighlighter stuff.
  const [hoverLine, setHoverLine] = useState(null as null | number);
  const [focusLine, setFocusLine] = useState(null as null | number);
  const inputRef = useRef(null as null | HTMLInputElement);

  // An effect that does the DOM-hackery necessary to get focus lines working.
  useEffect(() => {
    // Add focusLine class to the line that is currently focused.
    const lineTr = document.getElementById(`LineOfCode-${focusLine}`);
    lineTr?.classList.add("focusLine");

    // Remove class on cleanup.
    return () => lineTr?.classList.remove("focusLine");
  }, [focusLine]);

  function LineOfCode({
    row,
    lineNumber,
    stylesheet,
    useInlineStyles,
  }: {
    row: any;
    lineNumber: number;
    stylesheet: any;
    useInlineStyles: any;
  }) {
    return (
      <tr
        // Double-clicking on a line focuses on the line.
        onDoubleClick={() => {
          // NOTE: why focus first and then set focusLine? Should it be the
          // other way around?
          inputRef.current?.focus();
          setFocusLine(lineNumber + 1);
        }}
        // When you click on another line, clear the focused line.
        // TODO: maybe only clear focus line if we click on a line _other_ than
        // the focus line? The challenge is that we can't naively access
        // focusLine from here. Need to wrap it up as interior mutability or
        // something.
        onClick={() => setFocusLine(null)}
        // When you hover on a line, set the hoverLine.
        onMouseMove={() => setHoverLine(lineNumber + 1)}
        // These are the values from GitHub.
        style={{
          lineHeight: "20px",
          fontSize: "12px",
        }}
        // Set id so that we can pluck them out and do some DOM hackery to get focusLine set correctly.
        id={`LineOfCode-${lineNumber + 1}`}
      >
        <td
          style={{
            textAlign: "right",
            color: "#ccc",
            display: "block",
            marginRight: 20,
            width: 40,
            fontFamily:
              "SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace",
            padding: 0,
          }}
          className={"linenumber unselectable"}
        >
          {lineNumber + 1}
        </td>
        <td
          // This is the same font family that GitHub uses. Maybe try Fira Code?
          style={{
            fontFamily:
              "SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace",
            padding: 0,
          }}
          className={"lineofcode"}
        >
          {createElement({
            node: row,
            stylesheet,
            useInlineStyles,
            key: lineNumber,
          })}
        </td>
      </tr>
    );
  }

  const mySyntaxRenderer = ({
    rows,
    stylesheet,
    useInlineStyles,
  }: {
    rows: [{ tagName: string; properties: {}; children: [] }];
    stylesheet: any;
    useInlineStyles: any;
  }) => {
    return rows.map((row, ix) => (
      <LineOfCode
        row={row}
        key={ix}
        lineNumber={ix}
        stylesheet={stylesheet}
        useInlineStyles={useInlineStyles}
      ></LineOfCode>
    ));
  };

  // See https://github.com/react-syntax-highlighter/react-syntax-highlighter/issues/302.
  // SyntaxHighlighter doesn't like null strings understandably, so we need to check for that.
  const syntaxHighlighted = useMemo(
    () =>
      fileContents !== null ? (
        <SyntaxHighlighter
          renderer={mySyntaxRenderer}
          // "github-gist" actually appears to be closer to github's actual styling than "github".
          style={githubGist}
          PreTag={MyPreTag}
          CodeTag={"tbody"}
        >
          {/* Trim off the last whitespace on the file since we don't get blamelines for those lines, and so then bad
          things happen. This also reflects GitHubs behavior. */}
          {fileContents.trimEnd()}
        </SyntaxHighlighter>
      ) : null,
    [fileContents]
  );

  return (
    <Flex justifyContent="center" width="100%">
      <Grid
        gridTemplateColumns="repeat(2, auto)"
        className={focusLine !== null ? "focusLine" : "noFocusLine"}
      >
        {/* TODO: where are the "small", "medium", etc sizes documented? */}
        <Box width={272}>
          {/* TODO show a "loading thing" before we render the Comments component. */}
          {blameDone && fileContents !== null && (
            <Suspense fallback={<div>loading comments, such suspense!</div>}>
              <Comments
                commitSHA={commitSHA}
                filePath={filePath}
                fileContents={fileContents}
                hoverLine={hoverLine}
                focusLine={focusLine}
                setHoverLine={setHoverLine}
                setFocusLine={setFocusLine}
                inputRef={inputRef}
              />
            </Suspense>
          )}
        </Box>
        <BorderBox
          style={{ overflowX: "auto", marginTop: "13px", width: "768px" }}
          // Clear the hover line when the mouse leaves the CodeAndComments area. This makes it a lot more user-friendly
          // when trying to get rid of NewThreadPopover thing.
          onMouseLeave={() => setHoverLine(null)}
        >
          {syntaxHighlighted}
        </BorderBox>
      </Grid>
    </Flex>
  );
};

export default CodeAndComments;
