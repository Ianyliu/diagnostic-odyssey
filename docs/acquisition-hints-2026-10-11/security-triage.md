# Existing default-branch dependency alerts

The branch push reported two open moderate Dependabot alerts in the unchanged
`react-router` 6.30.6 dependency. They predate #23 and remain open; no dependency
migration is included in this narrowly authorized PR.

| Alert | Published condition | Targeted application assessment |
| --- | --- | --- |
| [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) / repository alert 7 | Attacker-supplied paths reaching Router navigation can produce unexpected external navigation | Existing Router targets are fixed internal route definitions/constants. No `useNavigate`, imported navigation destinations, uploaded requests or external target inputs were found. #23 uses native anchors for pinned official source locators, not Router destinations. No new reachable attack path identified by this source check. |
| [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg) / repository alert 6 | Specific SSR error hydration paths; the advisory excludes Declarative Mode | The app uses `createRoot` + `BrowserRouter`; no manual SSR/hydration or `deserializeErrors` integration was found. #23 adds none. |

Both advisories list 7.18.0 as patched. An upgrade crosses the existing major-version
boundary and needs separately scoped authorization/review. This assessment is a
bounded source-based inference, not dismissal of the alerts or a security certification.
Independent implementation/security review must confirm the navigation/configuration
boundary before merge. No alert was closed, no release risk was silently accepted,
and no production deployment is authorized.
