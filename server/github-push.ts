import { getUncachableGitHubClient } from './github-client';
import * as fs from 'fs';
import * as path from 'path';

const IGNORED_DIRS = ['.git', 'node_modules', '.cache', 'dist', 'attached_assets', '.local', '.npm', 'tmp', '.pnpm-store'];
const IGNORED_FILES = ['.env', '.replit', 'replit.nix', '.upm', '.config', '.breakpoints', 'package-lock.json'];

function getAllFiles(dir: string, basePath: string = ''): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name);
    
    if (IGNORED_DIRS.includes(entry.name) || IGNORED_FILES.includes(entry.name)) {
      continue;
    }
    
    if (entry.name.startsWith('.')) {
      continue;
    }
    
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, relativePath));
    } else if (entry.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        files.push({
          path: relativePath,
          content: content
        });
      } catch (e) {
        console.log(`Skipping ${relativePath}: ${e}`);
      }
    }
  }
  
  return files;
}

async function pushToGitHub() {
  const octokit = await getUncachableGitHubClient();
  const owner = 'carolyndriscoll-alpha';
  const repo = 'dok1grader';
  
  console.log('Getting all project files...');
  const files = getAllFiles(process.cwd());
  console.log(`Found ${files.length} files to push`);
  
  console.log('\nStep 1: Creating initial README to initialize repository...');
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: 'README.md',
    message: 'Initial commit',
    content: Buffer.from('# DOK1 Grading App\n\nA grading tool for educational brainlifts.').toString('base64'),
    branch: 'main'
  });
  console.log('README created!');
  
  console.log('\nStep 2: Getting latest commit SHA...');
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: 'heads/main'
  });
  const latestCommitSha = refData.object.sha;
  console.log(`Latest commit: ${latestCommitSha}`);
  
  console.log('\nStep 3: Creating blobs for all files...');
  const blobs: { path: string; sha: string }[] = [];
  let count = 0;
  
  for (const file of files) {
    try {
      const { data } = await octokit.git.createBlob({
        owner,
        repo,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64'
      });
      blobs.push({ path: file.path, sha: data.sha });
      count++;
      if (count % 20 === 0) {
        console.log(`  Processed ${count}/${files.length} files...`);
      }
    } catch (e: any) {
      console.log(`  Error with ${file.path}: ${e.message}`);
    }
  }
  console.log(`Created ${blobs.length} blobs`);
  
  const tree = blobs.map(blob => ({
    path: blob.path,
    mode: '100644' as const,
    type: 'blob' as const,
    sha: blob.sha
  }));
  
  console.log('\nStep 4: Creating tree...');
  const { data: treeData } = await octokit.git.createTree({
    owner,
    repo,
    tree,
    base_tree: latestCommitSha
  });
  
  console.log('\nStep 5: Creating commit...');
  const { data: commitData } = await octokit.git.createCommit({
    owner,
    repo,
    message: 'Add DOK1 Grading App source code',
    tree: treeData.sha,
    parents: [latestCommitSha]
  });
  
  console.log('\nStep 6: Updating main branch...');
  await octokit.git.updateRef({
    owner,
    repo,
    ref: 'heads/main',
    sha: commitData.sha
  });
  
  console.log('\n========================================');
  console.log('SUCCESS! Code pushed to GitHub!');
  console.log(`View at: https://github.com/${owner}/${repo}`);
  console.log('========================================');
}

pushToGitHub().catch(console.error);
