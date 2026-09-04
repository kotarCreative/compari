# Development data reset

Preview the development data that would be removed:

```sh
npm run reset:dev
```

The preview prints the exact confirmation command. Run that command to clear
every table in the configured personal Convex development deployment and delete
every inbox in the AgentMail pod named `demo`.

The helper deliberately refuses production deployment selectors. It reads
`AGENTMAIL_API_KEY` from `.env.local`, never prints the key, and stops before
making changes unless `--execute` and the exact confirmation phrase are both
present.
