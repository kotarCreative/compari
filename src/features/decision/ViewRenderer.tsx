type View = {
  _id: string
  label: string
  viewType: string
  configuration: {
    value?: {
      explanation?: string
      metricKeys?: Array<string>
      candidateIds?: Array<string>
    }
  }
}

/** Renders only the small, server-normalized view vocabulary. */
export function ViewRenderer({ views }: { views: Array<View> }) {
  if (!views.length) {
    return (
      <p className="text-sm text-slate-500">
        Comparison lenses will appear when provider responses arrive.
      </p>
    )
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {views.map((view) => (
        <TrustedView key={view._id} view={view} />
      ))}
    </div>
  )
}

function TrustedView({ view }: { view: View }) {
  const copy =
    view.configuration.value?.explanation ??
    'This trusted lens uses the evidence collected for this request.'
  const metrics = view.configuration.value?.metricKeys ?? []
  const candidates = view.configuration.value?.candidateIds ?? []
  const providerLabels = candidates.map((_, index) => `Provider ${index + 1}`)
  const heading = <h5 className="font-semibold">{view.label}</h5>
  const note = (
    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{copy}</p>
  )

  switch (view.viewType) {
    case 'recommendation':
      return (
        <article className="rounded border border-sky-300 bg-sky-50 p-3 dark:bg-slate-950">
          {heading}
          {note}
          <p className="mt-3 text-xs font-semibold text-sky-800 dark:text-sky-200">
            Recommendation is advisory. Confirm a current provider proposal
            below.
          </p>
        </article>
      )
    case 'provider_cards':
      return (
        <article className="rounded border p-3">
          {heading}
          {note}
          <div className="mt-3 grid gap-2">
            {providerLabels.length ? (
              providerLabels.map((provider) => (
                <div
                  className="rounded bg-slate-50 p-2 text-xs dark:bg-slate-900"
                  key={provider}
                >
                  {provider}
                  <span className="ml-2 text-slate-500">
                    Evidence available for review
                  </span>
                </div>
              ))
            ) : (
              <EmptyLens />
            )}
          </div>
        </article>
      )
    case 'comparison_matrix':
      return (
        <article className="overflow-auto rounded border p-3">
          {heading}
          {note}
          <table className="mt-3 w-full text-left text-xs">
            <thead>
              <tr>
                <th className="pr-3">Metric</th>
                {providerLabels.map((provider) => (
                  <th className="pr-3" key={provider}>
                    {provider}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.length ? (
                metrics.map((metric) => (
                  <tr className="border-t" key={metric}>
                    <th className="py-1 pr-3 font-medium">
                      {humanize(metric)}
                    </th>
                    {providerLabels.map((provider) => (
                      <td className="py-1 pr-3 text-slate-500" key={provider}>
                        See evidence
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="py-2 text-slate-500"
                    colSpan={Math.max(providerLabels.length + 1, 1)}
                  >
                    No comparable metric is available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      )
    case 'ranking':
      return (
        <article className="rounded border p-3">
          {heading}
          {note}
          <ol className="mt-3 space-y-1 text-xs">
            {providerLabels.length ? (
              providerLabels.map((provider, index) => (
                <li className="flex gap-2" key={provider}>
                  <span className="font-semibold">{index + 1}.</span>
                  {provider}
                  <span className="text-slate-500">
                    — ranking rationale in evidence
                  </span>
                </li>
              ))
            ) : (
              <EmptyLens />
            )}
          </ol>
        </article>
      )
    case 'bar':
      return (
        <article className="rounded border p-3">
          {heading}
          {note}
          <div className="mt-3 space-y-2">
            {metrics.length ? (
              metrics.map((metric) => (
                <div
                  className="rounded bg-slate-50 p-2 text-xs dark:bg-slate-900"
                  key={metric}
                >
                  <strong>{humanize(metric)}</strong>
                  <span className="ml-2 text-slate-500">
                    Open provider evidence to compare values.
                  </span>
                </div>
              ))
            ) : (
              <EmptyLens />
            )}
          </div>
        </article>
      )
    case 'timeline':
      return (
        <article className="rounded border p-3">
          {heading}
          {note}
          <ol className="mt-3 border-l-2 border-slate-300 pl-3 text-xs dark:border-slate-600">
            <li className="pb-2">
              <strong>Research</strong>
              <span className="ml-2 text-slate-500">public facts retained</span>
            </li>
            <li className="pb-2">
              <strong>Outreach</strong>
              <span className="ml-2 text-slate-500">
                only approved contact paths
              </span>
            </li>
            <li>
              <strong>Proposal review</strong>
              <span className="ml-2 text-slate-500">latest version wins</span>
            </li>
          </ol>
        </article>
      )
    case 'difference':
      return (
        <article className="rounded border p-3">
          {heading}
          {note}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-slate-50 p-2 dark:bg-slate-900">
              <strong>{providerLabels[0] ?? 'Provider A'}</strong>
              <p className="mt-1 text-slate-500">
                Review its retained facts and terms.
              </p>
            </div>
            <div className="rounded bg-slate-50 p-2 dark:bg-slate-900">
              <strong>{providerLabels[1] ?? 'Provider B'}</strong>
              <p className="mt-1 text-slate-500">
                Review its retained facts and terms.
              </p>
            </div>
          </div>
        </article>
      )
    case 'missing_information':
      return (
        <article className="rounded border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/30">
          {heading}
          {note}
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs">
            <li>Confirm scope and exclusions against the latest proposal.</li>
            <li>Confirm timing and availability before selecting.</li>
            {metrics.length ? (
              <li>Review: {metrics.map(humanize).join(', ')}.</li>
            ) : null}
          </ul>
        </article>
      )
    default:
      return (
        <article className="rounded border border-amber-300 p-3 text-sm">
          <h5 className="font-semibold">Unsupported comparison lens</h5>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            This unrecognized view was not rendered. Review the underlying
            evidence instead.
          </p>
        </article>
      )
  }
}

function EmptyLens() {
  return (
    <p className="text-xs text-slate-500">
      Waiting for enough comparable provider evidence.
    </p>
  )
}

function humanize(value: string) {
  return value.replace(/[_-]/g, ' ')
}
