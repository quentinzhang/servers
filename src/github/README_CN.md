# GitHub MCP 服务器

适用于 GitHub API 的 MCP 服务器，支持文件操作、仓库管理、搜索功能等。

### 功能

- **自动分支创建**：在创建/更新文件或推送更改时，如果分支不存在，会自动创建分支。
- **全面的错误处理**：为常见问题提供清晰的错误消息。
- **Git 历史保留**：操作会保留正确的 Git 历史记录，无需强制推送。
- **批量操作**：支持单文件和多文件操作。
- **高级搜索**：支持代码、问题/PR 和用户的搜索功能。

## 工具

1. `create_or_update_file`
   - 在仓库中创建或更新单个文件
   - 输入：
     - `owner` (string)：仓库拥有者（用户名或组织名）
     - `repo` (string)：仓库名称
     - `path` (string)：文件的创建/更新路径
     - `content` (string)：文件内容
     - `message` (string)：提交消息
     - `branch` (string)：创建/更新文件的分支
     - `sha` (可选 string)：被替换文件的 SHA（用于更新）
   - 返回：文件内容和提交详情

2. `push_files`
   - 在单次提交中推送多个文件
   - 输入：
     - `owner` (string)：仓库拥有者
     - `repo` (string)：仓库名称
     - `branch` (string)：推送的分支
     - `files` (array)：推送的文件列表，每个文件包含 `path` 和 `content`
     - `message` (string)：提交消息
   - 返回：更新的分支引用

3. `search_repositories`
   - 搜索 GitHub 仓库
   - 输入：
     - `query` (string)：搜索查询
     - `page` (可选 number)：分页页码
     - `perPage` (可选 number)：每页结果数（最大 100）
   - 返回：仓库搜索结果

4. `create_repository`
   - 创建新的 GitHub 仓库
   - 输入：
     - `name` (string)：仓库名称
     - `description` (可选 string)：仓库描述
     - `private` (可选 boolean)：是否为私有仓库
     - `autoInit` (可选 boolean)：是否初始化为包含 README 的仓库
   - 返回：创建的仓库详情

5. `get_file_contents`
   - 获取文件或目录的内容
   - 输入：
     - `owner` (string)：仓库拥有者
     - `repo` (string)：仓库名称
     - `path` (string)：文件/目录的路径
     - `branch` (可选 string)：获取内容的分支
   - 返回：文件/目录内容

6. `create_issue`
   - 创建新的问题（Issue）
   - 输入：
     - `owner` (string)：仓库拥有者
     - `repo` (string)：仓库名称
     - `title` (string)：问题标题
     - `body` (可选 string)：问题描述
     - `assignees` (可选 string[])：要分配的用户名
     - `labels` (可选 string[])：添加的标签
     - `milestone` (可选 number)：里程碑编号
   - 返回：创建的问题详情

7. `create_pull_request`
   - 创建新的拉取请求（PR）
   - 输入：
     - `owner` (string)：仓库拥有者
     - `repo` (string)：仓库名称
     - `title` (string)：PR 标题
     - `body` (可选 string)：PR 描述
     - `head` (string)：包含更改的分支
     - `base` (string)：要合并到的分支
     - `draft` (可选 boolean)：创建为草稿 PR
     - `maintainer_can_modify` (可选 boolean)：允许维护者编辑
   - 返回：创建的 PR 详情

8. `fork_repository`
   - 分叉（Fork）一个仓库
   - 输入：
     - `owner` (string)：仓库拥有者
     - `repo` (string)：仓库名称
     - `organization` (可选 string)：要分叉到的组织
   - 返回：分叉的仓库详情

9. `create_branch`
   - 创建新分支
   - 输入：
     - `owner` (string)：仓库拥有者
     - `repo` (string)：仓库名称
     - `branch` (string)：新分支的名称
     - `from_branch` (可选 string)：来源分支（默认为仓库默认分支）
   - 返回：创建的分支引用

10. `list_issues`
    - 列出并筛选仓库问题（Issue）
    - 输入：
      - `owner` (string)：仓库拥有者
      - `repo` (string)：仓库名称
      - `state` (可选 string)：按状态筛选（'open', 'closed', 'all'）
      - `labels` (可选 string[])：按标签筛选
      - `sort` (可选 string)：排序依据（'created', 'updated', 'comments'）
      - `direction` (可选 string)：排序方向（'asc', 'desc'）
      - `since` (可选 string)：按日期筛选（ISO 8601 时间戳）
      - `page` (可选 number)：分页页码
      - `per_page` (可选 number)：每页结果数
    - 返回：问题详情数组

11. `update_issue`
    - 更新现有问题（Issue）
    - 输入：
      - `owner` (string)：仓库拥有者
      - `repo` (string)：仓库名称
      - `issue_number` (number)：要更新的问题编号
      - `title` (可选 string)：新标题
      - `body` (可选 string)：新描述
      - `state` (可选 string)：新状态（'open' 或 'closed'）
      - `labels` (可选 string[])：新标签
      - `assignees` (可选 string[])：新分配
      - `milestone` (可选 number)：新里程碑编号
    - 返回：更新的问题详情

12. `add_issue_comment`
    - 为问题（Issue）添加评论
    - 输入：
      - `owner` (string)：仓库拥有者
      - `repo` (string)：仓库名称
      - `issue_number` (number)：要评论的问题编号
      - `body` (string)：评论内容
    - 返回：创建的评论详情

13. `search_code`
    - 搜索 GitHub 仓库中的代码
    - 输入：
      - `q` (string)：使用 GitHub 代码搜索语法的搜索查询
      - `sort` (可选 string)：排序字段（仅支持 'indexed'）
      - `order` (可选 string)：排序顺序（'asc' 或 'desc'）
      - `per_page` (可选 number)：每页结果数（最大 100）
      - `page` (可选 number)：分页页码
    - 返回：代码搜索结果及其仓库上下文

14. `search_issues`
    - 搜索问题和拉取请求（PR）
    - 输入：
      - `q` (string)：使用 GitHub 问题搜索语法的搜索查询
      - `sort` (可选 string)：排序字段（comments, reactions, created 等）
      - `order` (可选 string)：排序顺序（'asc' 或 'desc'）
      - `per_page` (可选 number)：每页结果数（最大 100）
      - `page` (可选 number)：分页页码
    - 返回：问题和拉取请求搜索结果

15. `search_users`
    - 搜索 GitHub 用户
    - 输入：
      - `q` (string)：使用 GitHub 用户搜索语法的搜索查询
      - `sort` (可选 string)：排序字段（followers, repositories, joined）
      - `order` (可选 string)：排序顺序（'asc' 或 'desc'）
      - `per_page` (可选 number)：每页结果数（最大 100）
      - `page` (可选 number)：分页页码
    - 返回：用户搜索结果

16. list_commits
- 获取仓库中特定分支的提交记录
- 输入参数：
  - `owner` (字符串): 仓库拥有者
  - `repo` (字符串): 仓库名称
  - `page` (可选字符串): 页码
  - `per_page` (可选字符串): 每页记录数
  - `sha` (可选字符串): 分支名称
- 返回：提交记录列表

17. get_issue
- 获取仓库中某个 Issue 的内容
- 输入参数：
  - `owner` (字符串): 仓库拥有者
  - `repo` (字符串): 仓库名称
  - `issue_number` (数字): 要检索的 Issue 编号
- 返回：GitHub Issue 对象及详情

## 搜索查询语法

### 代码搜索
- `language:javascript`: 按编程语言搜索
- `repo:owner/name`: 在特定仓库中搜索
- `path:app/src`: 在特定路径中搜索
- `extension:js`: 按文件扩展名搜索
- 示例：`q: "import express" language:typescript path:src/`

### Issue 搜索
- `is:issue` 或 `is:pr`: 按类型过滤
- `is:open` 或 `is:closed`: 按状态过滤
- `label:bug`: 按标签搜索
- `author:username`: 按作者搜索
- 示例：`q: "memory leak" is:issue is:open label:bug`

### 用户搜索
- `type:user` 或 `type:org`: 按账户类型过滤
- `followers:>1000`: 按关注者数量过滤
- `location:London`: 按位置搜索
- 示例：`q: "fullstack developer" location:London followers:>100`

有关详细搜索语法，请参见 [GitHub 搜索文档](https://docs.github.com/en/search-github/searching-on-github)。

## 设置

### 个人访问令牌
[创建 GitHub 个人访问令牌](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)，以获得相应的权限：
1. 前往 [个人访问令牌](https://github.com/settings/tokens)（GitHub 设置 > 开发者设置）
2. 选择希望此令牌访问的仓库范围（公共、全部或特定仓库）
3. 创建带有 `repo` 范围的令牌（“完全控制私有仓库”）
   - 如果仅需处理公共仓库，可选择 `public_repo` 范围
4. 复制生成的令牌

### 在 Claude Desktop 中使用
要在 Claude Desktop 中使用此功能，请在 `claude_desktop_config.json` 中添加以下内容：

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_TOKEN>"
      }
    }
  }
}
```

## 许可证

此 MCP 服务器遵循 MIT 许可证。这意味着您可以自由使用、修改和分发本软件，但需遵守 MIT 许可证的条款和条件。有关详细信息，请参阅项目仓库中的 LICENSE 文件。

