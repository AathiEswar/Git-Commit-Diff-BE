const express = require('express');
const axios = require('axios');
const cors = require('cors')
require('dotenv').config();

const app = express();
app.use(cors()); 
const PORT = process.env.PORT || 5000;

// Fetch commit details from GitHub
app.get('/repositories/:owner/:repository/commits/:oid', async (req, res) => {
  const { owner, repository, oid } = req.params;
  const GITHUB_API_URL = `https://api.github.com/repos/${owner}/${repository}/commits/${oid}`;

  try {
    const response = await axios.get(GITHUB_API_URL);
    const commitData = response.data;

    res.json({
      oid: commitData.sha,
      message: commitData.commit.message,
      author: {
        name: commitData.commit.author.name,
        date: commitData.commit.author.date,
        email: commitData.commit.author.email,
      },
      committer: {
        name: commitData.commit.committer.name,
        date: commitData.commit.committer.date,
        email: commitData.commit.committer.email,
      },
      parents: commitData.parents.map(parent => ({ oid: parent.sha })),
      avatar_url : commitData.author.avatar_url,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch commit details from GitHub API' });
  }
});

// Fetch commit diff from GitHub
app.get('/repositories/:owner/:repository/commits/:oid/diff', async (req, res) => {
  const { owner, repository, oid } = req.params;
  const COMMIT_API_URL = `https://api.github.com/repos/${owner}/${repository}/commits/${oid}`;

  try {
    // Get Parent Commit SHA
    const commitResponse = await axios.get(COMMIT_API_URL);
    const filesChanged = commitResponse.data.files;

    res.json(filesChanged.map(file => ({
      changeKind: file.status.toUpperCase(),
      headFile: { path: file.filename },
      baseFile: { path: file.filename },
      hunks: parsePatch(file.patch),
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch commit diff data from GitHub API' });
  }
});

// Parse diff patch
const parsePatch = (patch) => {
  if (!patch) return [];

  const lines = patch.split('\n');
  const hunks = [];
  let currentHunk = null;
  let baseLine = 0;
  let headLine = 0;

  lines.forEach(line => {
    const hunkHeaderMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
    console.log(hunkHeaderMatch);
    if (hunkHeaderMatch) {
      if (currentHunk) hunks.push(currentHunk);

      baseLine = parseInt(hunkHeaderMatch[1], 10);
      headLine = parseInt(hunkHeaderMatch[3], 10);

      currentHunk = { header: line, lines: [] };
    } else if (currentHunk) {
      let baseNum = null, headNum = null;
      if (line.startsWith('-')) {
        baseNum = baseLine++;
      } else if (line.startsWith('+')) {
        headNum = headLine++;
      } else {
        baseNum = baseLine++;
        headNum = headLine++;
      }
      console.log("base Line:",baseLine, "base Num : " , baseNum, "head Line : " , headLine ,"Head num : " ,headNum);
      currentHunk.lines.push({ baseLineNumber: baseNum, headLineNumber: headNum, content: line });
      
    }
  });

  if (currentHunk) hunks.push(currentHunk);
  return hunks;
};

app.listen(PORT, () => {
  console.log(`Server running at PORT: ${PORT}`);
});
