import { PlanningPrototypePicker } from './picker'

export default async function PlanningPrototypePage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const params = await searchParams
  const requested = Number(params.v) - 1
  const initialActive = Number.isInteger(requested) && requested >= 0 && requested <= 2 ? requested : 0
  return <PlanningPrototypePicker initialActive={initialActive} />
}
