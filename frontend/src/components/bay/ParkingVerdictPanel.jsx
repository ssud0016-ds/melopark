import { cn } from '../../utils/cn'
import { formatLeaveByClock } from '../../utils/plannerTime'
import { formatStayLimitShort } from '../../utils/plannerTime'

function ruleLabelFromType(type) {
  const t = (type || '').toLowerCase()
  if (t === 'clearway') return 'Tow-Away Zone'
  if (t === 'no_standing') return 'No Standing'
  if (t === 'loading') return 'Loading Zone'
  if (t === 'disabled') return 'Disability Permit Only'
  return null
}

function durationLabel(durationMins) {
  if (typeof durationMins !== 'number' || !Number.isFinite(durationMins) || durationMins <= 0) return null
  if (durationMins % 60 === 0 && durationMins <= 6 * 60) return `${durationMins / 60}P`
  if (durationMins >= 60) return `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`.replace(' 0m', '')
  return `${durationMins}m`
}

/**
 * Parking verdict block matching mobile "Parking Tab" designs.
 *
 * Variants:
 * - YES: sensor free + verdict yes + no mid-stay warning
 * - CAUTION: sensor free + verdict yes + warning starts within requested stay
 * - NO: sensor occupied OR verdict no
 *
 * Props:
 * - variant: "yes" | "no" | "caution"
 * - durationMins: number
 * - evaluation: BayEvaluation | null
 */
export default function ParkingVerdictPanel({ variant, durationMins, evaluation }) {
  const restriction = evaluation?.active_restriction ?? null
  const warning = evaluation?.warning ?? null
  const permitOnly =
    (warning?.type || '').toLowerCase() === 'disabled' ||
    (restriction?.rule_category || '').toLowerCase() === 'disabled'

  const translatorRules = evaluation?.translator_rules ?? []
  const currentRule = translatorRules.find((r) => r.state === 'current') ?? null
  const outsideRule = translatorRules.find((r) => r.state === 'outside') ?? null
  const noPayment =
    restriction?.rule_category === 'free' ||
    (!currentRule && !!outsideRule) ||
    /(no\s+payment|no\s+limit\s+and\s+no\s+payment)/i.test(currentRule?.body || '')

  const paymentRequired = !evaluation ? null : noPayment ? 'No' : 'Yes'

  const stayLimit =
    restriction?.max_stay_mins != null
      ? (formatStayLimitShort(restriction.max_stay_mins) ?? `${restriction.max_stay_mins} min`)
      : null

  const leaveBy =
    (restriction?.expires_at && formatLeaveByClock(restriction.expires_at)) ||
    (warning?.starts_at && formatLeaveByClock(warning.starts_at)) ||
    null

  const warningMinutes = warning?.minutes_into_stay ?? null
  const requested = durationLabel(durationMins)

  const panelTone =
    permitOnly
      ? 'bg-[#F7B38A]'
      : variant === 'yes'
      ? 'bg-[#CFF57A]'
      : variant === 'no'
        ? 'bg-[#F59A9A]'
        : 'bg-[#F7B38A]'

  const word =
    permitOnly ? 'PERMIT' : (variant === 'yes' ? 'YES' : variant === 'no' ? 'NO' : 'Caution')

  const sentence =
    permitOnly
      ? 'Disability permit required to park here'
      : variant === 'yes'
      ? 'You can park here'
      : variant === 'no'
        ? 'You cannot park here'
        : 'You cannot park here fully'

  const showRestrictionRow = variant === 'caution'
  const restrictionLabel =
    ruleLabelFromType(warning?.type) ||
    ruleLabelFromType(restriction?.rule_category) ||
    'Restriction'

  const restrictionValue =
    ruleLabelFromType(warning?.type) ||
    ruleLabelFromType(restriction?.rule_category) ||
    warning?.typedesc ||
    restriction?.typedesc ||
    null

  const cautionBody =
    warning?.description ||
    (warningMinutes != null && requested
      ? `This bay is okay at first, but restrictions start about ${warningMinutes} minutes into your ${requested} stay.`
      : null)

  const noBody = (() => {
    if (!evaluation) return null
    if (permitOnly) {
      return (
        restriction?.plain_english ||
        warning?.description ||
        'This bay is reserved for drivers displaying a valid disability parking permit.'
      )
    }
    const hasTranslatorCards = Array.isArray(evaluation?.translator_rules) && evaluation.translator_rules.length > 0
    if (hasTranslatorCards) return null
    if (variant === 'no' && evaluation?.verdict === 'no' && restriction?.max_stay_mins != null && typeof durationMins === 'number') {
      if (durationMins > restriction.max_stay_mins) {
        const hrs = restriction.max_stay_mins % 60 === 0 ? `${restriction.max_stay_mins / 60} hours` : `${restriction.max_stay_mins} minutes`
        const req = requested ? requested.replace('P', ' hours').replace('h', ' hours') : `${durationMins} minutes`
        return `This parking spot only allows ${hrs} of parking. You are currently looking for ${req} of parking`
      }
    }
    if (variant === 'no' && evaluation?.reason) return evaluation.reason
    return null
  })()

  const trustNote = (() => {
    const source = evaluation?.data_source
    if (source === 'api_fallback') return 'Rule estimate from external category data. Check street sign.'
    if (source === 'unknown') return 'No reliable restriction data for this bay. Check street sign.'
    return null
  })()

  return (
    <div className={cn('mx-5 mt-3 rounded-2xl p-5', panelTone)}>
      {permitOnly ? (
        <>
          <div className="text-5xl font-extrabold tracking-tight text-[#263089]">
            {word}
          </div>
          <div className="mt-1 text-sm font-semibold text-[#263089]">{sentence}</div>
        </>
      ) : (
        <div className="flex items-baseline gap-3">
          <div className="text-5xl font-extrabold tracking-tight text-[#263089]">
            {word}
          </div>
          <div className="text-sm font-semibold text-[#263089]">{sentence}</div>
        </div>
      )}
      {trustNote && (
        <div className="mt-2 rounded-lg bg-white/35 px-3 py-2 text-[11px] font-semibold text-[#263089]">
          {trustNote}
        </div>
      )}

      <hr className="mt-3 border-t border-[#263089]/20" />

      <div className="mt-3 space-y-2.5 text-sm text-[#263089]">
        {showRestrictionRow && (
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold">Parking Restriction:</div>
            <div className="font-semibold">{restrictionValue || restrictionLabel}</div>
          </div>
        )}

        {paymentRequired && (
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold">{permitOnly ? 'Permit Required:' : 'Payment Required:'}</div>
            <div className="font-semibold">{paymentRequired}</div>
          </div>
        )}

        {stayLimit && (
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold">Stay Limit:</div>
            <div className="font-semibold">{stayLimit}</div>
          </div>
        )}

        {leaveBy && (
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold">Leave By:</div>
            <div className="font-semibold">{leaveBy}</div>
          </div>
        )}
      </div>

      {(variant === 'caution' || variant === 'no') && (cautionBody || noBody) && (
        <div className="mt-4 rounded-xl bg-white/30 px-4 py-3 text-[12px] leading-relaxed text-[#263089]">
          {variant === 'caution' ? cautionBody : noBody}
        </div>
      )}
    </div>
  )
}

