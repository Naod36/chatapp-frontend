# React + Vite

## Conversation Organization

- Deploy the backend `conversation_organization` migration and authenticated
  `GET/PATCH /conversation-organization` routes before using archives and folders.
- Archives hide conversations from Inbox, Unread, and Groups without changing mute or
  notification settings. New messages do not automatically unarchive a conversation.
  Custom folders include archived members; deleting folders never deletes conversations.
- Organization is server-owned per account, refreshed on focus and every 15 seconds while
  visible. Only confirmed mutations update the UI. On ambiguous errors, refresh before retrying.
  Mobile clients do not yet consume this organization API.
- Focused checks: `node --test tests/conversation-organization.test.js` and `npm run build`.
  Live database persistence and concurrent-client checks remain pending.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
