/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"
import { HarnessPassMeter } from "../components/harness-pass-meter"

const meta: Meta<typeof HarnessPassMeter> = {
  title: "Components/Harness Pass Meter",
  component: HarnessPassMeter,
  decorators: [
    (Story) => (
      <div style={{ padding: "16px", width: "320px" }}>
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
}

export default meta
type Story = StoryObj<typeof HarnessPassMeter>

const format = (value: number) => `$${value.toFixed(2)}`
const render = (used: number, paid: number, bonus: number) => (
  <HarnessPassMeter
    used={used}
    paid={paid}
    bonus={bonus}
    label="This month's usage"
    paidLabel="Paid"
    bonusLabel="Bonus"
    format={format}
    aria-label="Harness Pass monthly usage"
  />
)

export const CurrentPlan: Story = { render: () => render(73.27, 199, 99.5) }
export const UsingBonus: Story = { render: () => render(240, 199, 99.5) }
export const PaidOnly: Story = { render: () => render(73.27, 199, 0) }
export const Empty: Story = { render: () => render(0, 0, 0) }
export const OverLimit: Story = { render: () => render(325, 199, 99.5) }
