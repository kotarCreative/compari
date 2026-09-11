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
        Comparison lenses will appear when website prices or provider responses
        are available.
      </p>
    )
  }
  const infoViews = views.filter(
    (view) =>
      view.viewType === 'provider_cards' ||
      view.viewType === 'comparison_matrix',
  )
  const detailViews = views.filter(
    (view) =>
      view.viewType !== 'provider_cards' &&
      view.viewType !== 'comparison_matrix',
  )
  return (
    <div className="space-y-3">
      {infoViews.length ? (
        <div className="flex flex-wrap gap-2">
          {infoViews.map((view) => (
            <InfoTooltip key={view._id} view={view} />
          ))}
        </div>
      ) : null}
      {detailViews.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {detailViews.map((view) => (
            <TrustedView key={view._id} view={view} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function InfoTooltip({ view }: { view: View }) {
  const copy =
    view.viewType === 'provider_cards'
      ? 'The option cards below summarize published website prices and the latest received provider responses.'
      : 'A full comparison table is still in development. Review each option card for its current terms and missing details.'
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-slate-300 bg-white/55 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-500 hover:text-sky-800 [&::-webkit-details-marker]:hidden">
        {view.label}
        <span aria-hidden="true" className="text-sm text-sky-700">
          ⓘ
        </span>
      </summary>
      <p
        className="absolute left-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-3rem))] rounded-lg border border-slate-300 bg-[#fffdf7] p-3 text-xs font-normal leading-5 text-slate-600 shadow-lg"
        role="note"
      >
        {copy}
      </p>
    </details>
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
        <article className="pl-4 py-3">
          {heading}
          {note}
          <p className="mt-3 text-xs font-semibold text-sky-800 dark:text-sky-200">
            Recommendation is advisory. Confirm the current cited website or
            provider proposal below.
          </p>
        </article>
      )
    case 'ranking':
      return (
        <article className="py-4">
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
        <article className="py-4">
          {heading}
          {note}
          <div className="mt-3 space-y-2">
            {metrics.length ? (
              metrics.map((metric) => (
                <div className="py-2 text-xs" key={metric}>
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
        <article className="py-4">
          {heading}
          {note}
          <ol className="mt-3 pl-3 text-xs dark:border-slate-600">
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
        <article className="py-4">
          {heading}
          {note}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="pl-3">
              <strong>{providerLabels[0] ?? 'Provider A'}</strong>
              <p className="mt-1 text-slate-500">
                Review its retained website or provider facts and terms.
              </p>
            </div>
            <div className="pl-3">
              <strong>{providerLabels[1] ?? 'Provider B'}</strong>
              <p className="mt-1 text-slate-500">
                Review its retained website or provider facts and terms.
              </p>
            </div>
          </div>
        </article>
      )
    case 'missing_information':
      return (
        <article className="pl-4 py-3">
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
        <article className="pl-4 py-3 text-sm">
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
