# AVD Manager - Azure Virtual Desktop Admin Tool

Stop clicking through the Azure Portal to manage your Azure Virtual Desktop environment. This VS Code extension gives AVD admins a single pane of glass for host pools, session hosts, user sessions, image templates, scaling plans, and diagnostics — all without leaving your editor.

---

## How to Install

### Option A: From the VS Code Marketplace (recommended)

1. Open **VS Code**
2. Go to the **Extensions** view — click the Extensions icon in the left sidebar, or press `Ctrl+Shift+X`
3. Search for **"AVD Session Host Manager"**
4. Click **Install**
5. Done — you'll see a new **AVD Manager** icon in the left Activity Bar

### Option B: Install from .vsix file

If your organization distributes extensions internally:

1. Download the `.vsix` file from your admin
2. In VS Code, press `Ctrl+Shift+P` → type **"Install from VSIX"** → select the file
3. Reload VS Code when prompted

---

## How to Sign In (Entra ID / Azure AD)

This extension uses **Microsoft Entra ID** (formerly Azure AD) authentication — the same sign-in you use for the Azure Portal, Microsoft 365, and Teams. It opens your browser for sign-in, so it fully supports:

- Multi-Factor Authentication (MFA)
- Conditional Access policies
- Single Sign-On (SSO) with your org account
- Any enterprise security policy your IT team has in place

> **Note:** This extension does NOT use device code flow. It uses VS Code's built-in Microsoft authentication, which goes through your browser like any normal Azure sign-in.

### Step-by-step sign-in

1. Click the **AVD Manager** icon in the Activity Bar (left sidebar)
2. Click **"Sign in to Azure..."** in the panel that appears
3. **Your browser opens** — sign in with your work or school account (e.g., `yourname@company.com`)
4. Complete MFA if prompted by your organization
5. **Switch back to VS Code** — you're signed in
6. If you have multiple subscriptions, a picker appears — select the one with your AVD resources

That's it. Your host pools, session hosts, and user sessions appear in the tree view.

### To sign out

Press `Ctrl+Shift+P` → type **"AVD: Sign Out from Azure"**

### To change subscription

Press `Ctrl+Shift+P` → type **"AVD: Select Subscription"**

---

## What You Can Do

### Browse & monitor your AVD environment

The tree view shows your entire AVD hierarchy at a glance:

```
📁 Host Pool: hp-prod-eastus (Pooled | rg-avd)
   🟢 vm-avd-001.contoso.com — Available
   🟠 vm-avd-002.contoso.com — Draining | Available
   🔴 vm-avd-003.contoso.com — Unavailable
      👤 CONTOSO\jdoe — Active | Desktop
      👤 user2@contoso.com — Disconnected | RemoteApp
```

- **Green** = available and accepting connections
- **Orange** = drain mode ON (no new sessions, existing sessions continue)
- **Red** = unavailable (heartbeat lost, agent issue, or VM stopped)

Health status **auto-refreshes every 30 seconds** by default. You can change this in Settings or disable it.

### Manage session hosts (right-click)

Right-click any session host to:

| Action | What it does |
|--------|-------------|
| **Set Drain Mode** | Stop new connections — existing sessions continue |
| **Remove Drain Mode** | Accept new connections again |
| **Restart Session Host** | Restarts the underlying Azure VM (confirmation required) |
| **Delete Session Host** | Remove from host pool (confirmation required) |
| **View Details** | Opens a detail panel with status, OS version, agent version, heartbeat |

### Manage user sessions (right-click)

Right-click any user session to:

| Action | What it does |
|--------|-------------|
| **Log Off User Session** | Force log-off (saves nothing — confirmation required) |
| **Disconnect User Session** | Disconnect but keep session alive for reconnect |
| **Send Message to User** | Send a pop-up message (e.g., "Maintenance in 30 minutes") |
| **View Session Details** | See user, session ID, application type, session state |

### Scaffold golden image templates

Right-click a host pool → **Scaffold Packer Template** or **Scaffold Azure Image Builder Template**

Generates a ready-to-use template with your choice of:
- FSLogix Profile Containers
- New Microsoft Teams (with AVD optimization registry keys)
- Language packs
- MSIX App Attach (Hyper-V enabled)
- OneDrive per-machine install
- Windows Updates (Preview updates excluded)

Supports Windows 11 Multi-Session (24H2, 23H2) and Windows 10 Multi-Session (22H2).

### Generate scaling plan Bicep

Right-click a host pool → **Generate Scaling Plan Bicep**

Walk through a guided wizard:
1. Name your scaling plan
2. Pick a timezone
3. Set ramp-up / peak / ramp-down / off-peak times
4. Set minimum host percentages
5. Choose whether to include a weekend schedule

Outputs a ready-to-deploy Bicep file using `Microsoft.DesktopVirtualization/scalingPlans`.

### View session diagnostics

Right-click a host pool → **View Session Logs** or **Analyze Disconnect Reasons**

- **Session Logs** — queries `WVDConnections` in Log Analytics for the last 24 hours
- **Disconnect Analysis** — joins `WVDConnections` + `WVDErrors` to show actual disconnect reasons, error codes, and failure counts

> **Tip:** Set your Log Analytics Workspace ID in Settings to skip the prompt every time.

---

## Settings

Open VS Code Settings (`Ctrl+,`) and search for "AVD":

| Setting | Default | What it does |
|---------|---------|-------------|
| `avd.autoRefreshIntervalSeconds` | `30` | How often the tree view refreshes (in seconds). Set to `0` to turn off auto-refresh. |
| `avd.logAnalyticsWorkspaceId` | *(empty)* | Your Log Analytics Workspace ID (a GUID). When set, diagnostics commands don't ask you for it each time. |

---

## Azure Permissions Your Account Needs

Your Entra ID account must have these roles assigned on the subscription or resource group containing your AVD resources:

| What you want to do | Azure RBAC role needed |
|---------------------|----------------------|
| View host pools, session hosts, user sessions | **Desktop Virtualization Reader** |
| Drain/undrain session hosts, manage user sessions | **Desktop Virtualization Session Host Operator** |
| Restart session host VMs | **Virtual Machine Contributor** (on the VM resource group) |
| Delete session hosts | **Desktop Virtualization Contributor** |
| View session diagnostics (Log Analytics) | **Log Analytics Reader** (on the workspace) |

If you can see your AVD resources in the Azure Portal, you likely have the right permissions. If the tree view shows errors, ask your Azure admin to verify your role assignments.

---

## Security & Privacy

- **Browser-based Entra ID sign-in** — no device codes, no tokens pasted into terminals
- **Tokens stay in memory** — never written to disk by this extension
- **No telemetry** — this extension does not send any data anywhere except Azure Resource Manager APIs
- **No app registration required** — uses VS Code's built-in Microsoft authentication provider
- **Confirmation dialogs** — destructive actions (restart, delete, log-off) always require explicit confirmation
- **Content Security Policy** — all webview panels are locked down with `default-src 'none'`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Sign in to Azure..." doesn't appear | Make sure the extension is installed and enabled. Look for "AVD Manager" in the Activity Bar. |
| Browser doesn't open when signing in | Check your VS Code default browser setting. Try `Ctrl+Shift+P` → "AVD: Sign In to Azure" |
| "No Azure subscriptions found" | Your account may not have access. Verify in the Azure Portal that you can see subscriptions. |
| Tree view is empty after sign-in | You may be in the wrong subscription. Press `Ctrl+Shift+P` → "AVD: Select Subscription" |
| Session host shows red (Unavailable) | The VM may be stopped or the AVD agent is unhealthy. Check the Azure Portal for VM status. |
| Diagnostics says "Enter Workspace ID" | Set `avd.logAnalyticsWorkspaceId` in VS Code Settings, or enter the GUID of your Log Analytics workspace that has AVD diagnostics enabled. |
| "Azure session expired" | Press `Ctrl+Shift+P` → "AVD: Sign In to Azure" to re-authenticate |

---

## All Commands

Press `Ctrl+Shift+P` and type "AVD" to see all available commands:

| Command | Description |
|---------|-------------|
| AVD: Sign In to Azure | Sign in with your Entra ID (Azure AD) account |
| AVD: Sign Out from Azure | Sign out and clear session |
| AVD: Select Subscription | Switch to a different Azure subscription |
| AVD: Refresh | Manually refresh the tree view |
| AVD: Set Drain Mode | Enable drain mode on a session host |
| AVD: Remove Drain Mode | Disable drain mode |
| AVD: Restart Session Host | Restart the underlying VM |
| AVD: Delete Session Host | Remove session host from pool |
| AVD Image: Scaffold Packer Template | Generate a Packer HCL golden image template |
| AVD Image: Scaffold Azure Image Builder Template | Generate an AIB ARM template |
| AVD Scaling: Generate Scaling Plan Bicep | Generate a scaling plan Bicep file |
| AVD Diagnostics: View Session Logs | Query session connection logs |
| AVD Diagnostics: Analyze Disconnect Reasons | Analyze disconnect reasons with error codes |

---

## License

MIT
