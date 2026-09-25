<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the authenticated navigation fixed on desktop and as a dismissible, route-aware drawer on mobile; shared AppShell owns this behavior so every ERP module remains reachable on phones.
- Keep wide ERP tables scrollable inside their own surface on narrow screens; this preserves complete rows without widening the page.
