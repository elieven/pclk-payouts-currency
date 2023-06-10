import { z } from "zod";
import { useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from '@hookform/resolvers/zod';
import { create } from 'zustand'

import "./styles.css";

function isNumber(val: unknown): val is number {
  return typeof val === 'number' && !isNaN(val);
}

function numberOr(val: unknown, or: number): number {
  return isNumber(val) ? val : or;
}

export const useStore = create<{
  totalReward: number,
  setTotalReward: (value: number) => void,
}>((set) => ({
  totalReward: 5460,
  setTotalReward: (value: number) => set({ totalReward: value }),
}));

// Allow editing both percentage or currency amount. Changing ones
// recalculates and changes the other. Careful to not introduce any
// infinite loops of recalculation / updates.

const payoutStructureSchema = z.array(
  z.object({
    recipient_count: z
      .number()
      .min(1, { message: "There must be at least one recipient" }),
    percent_amount: z
      .number()
      .min(0, { message: "Must not be lower than 0" })
      .max(100, { message: "Must be 100 or less" }),
    currency_amount: z.number().optional()
  })
);

type PayoutStructure = z.infer<typeof payoutStructureSchema>;

const test_payout_structure: PayoutStructure = [
  {
    recipient_count: 1,
    percent_amount: 50
  },
  {
    recipient_count: 1,
    percent_amount: 30
  },
  {
    recipient_count: 2,
    percent_amount: 20
  }
];

const formDataSchema = z.object({
  payoutStructure: payoutStructureSchema
});

type FormData = z.infer<typeof formDataSchema>;

function getPercentageAmount(
  currency_amount: number,
  total_reward: number,
  recipient_count: number
) {
  const amount = (currency_amount / total_reward) * 100 * recipient_count
  return Number(amount.toFixed(2));
}

function getCurrencyAmount(
  percent_amount: number,
  total_reward: number,
  recipient_count: number
) {
  const amount = ((percent_amount / 100) * total_reward) / recipient_count
  return Number(amount.toFixed(2));
}

export default function App() {
  const { totalReward, setTotalReward } = useStore();

  const { control, watch, setValue, getValues, handleSubmit, formState: {errors} } = useForm<FormData>({
    resolver: zodResolver(formDataSchema),
    defaultValues: {
      payoutStructure: test_payout_structure.map((row) =>
        row.currency_amount
          ? row
          : {
              ...row,
              currency_amount: getCurrencyAmount(
                row.percent_amount,
                totalReward,
                row.recipient_count
              )
            }
      )
    }
  });

  const { fields, remove, append } = useFieldArray<FormData>({
    control,
    name: "payoutStructure",
  });

  // changes currency_amount
  const handleRecipientsChange = (index: number, value: number) => {
    const currency_amount = Number(getValues(`payoutStructure.${index}.currency_amount`));
    const percent_amount = Number(getValues(`payoutStructure.${index}.percent_amount`));

    value = Number(value);

    const next_currency_amount = getCurrencyAmount(
      percent_amount,
      totalReward,
      value,
    );

    setValue(`payoutStructure.${index}.currency_amount`, next_currency_amount);

    console.log({value, currency_amount, next_currency_amount})
  }

  // changes currency_amount
  const handlePercentageChange = (index: number, value: number) => {
    const recipient_count = Number(getValues(`payoutStructure.${index}.recipient_count`));
    const currency_amount = Number(getValues(`payoutStructure.${index}.currency_amount`));

    value = Number(value);

    const next_currency_amount = getCurrencyAmount(
      value,
      totalReward,
      recipient_count
    );

    setValue(`payoutStructure.${index}.currency_amount`, next_currency_amount);

    console.log({value, recipient_count, currency_amount, next_currency_amount});
  };

  // changes percent_amount
  const handleCurrencyChange = (index: number, value: number) => {
    const recipient_count = Number(getValues(`payoutStructure.${index}.recipient_count`));
    const percent_amount = Number(getValues(`payoutStructure.${index}.percent_amount`));

    value = Number(value);

    const next_percent_amount = getPercentageAmount(
      value,
      totalReward,
      recipient_count
    );

    setValue(`payoutStructure.${index}.percent_amount`, next_percent_amount);

    console.log({value, recipient_count, percent_amount, next_percent_amount});
  };

  const payouts_rows_that_are_numbers =  watch('payoutStructure').filter(obj => Object.values(obj).every(val => isNumber(val)));


  // no need to convert to number since it is just a string to be displayed in the UI
  const percent_sum = payouts_rows_that_are_numbers.reduce((total, payout) => total + payout.percent_amount, 0).toFixed(2);

  useEffect(() => {
    fields.forEach((_field, index) => {
      const { recipient_count, percent_amount} = getValues(`payoutStructure.${index}`);
      // recalc and update only currency amount since only the total reward changed
      const new_currency_amount = getCurrencyAmount(
        percent_amount,
        totalReward,
        recipient_count
      );
      setValue(`payoutStructure.${index}.currency_amount`, new_currency_amount);
    });
  }, [totalReward, fields, getValues, setValue]); // Re-run this effect when totalReward changes

  // console.log({payoutStructure})

  console.log('errors', errors)

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <p>Total reward to distribute: <input type="number" defaultValue={totalReward} onChange={e => setTotalReward(+e.target.value)}/> $</p>
      <table>
        <thead>
          <tr>
            <td>#</td>
            <td>Recipients</td>
            <td>Payout %</td>
            <td>Payout $</td>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => {
            return (
              <tr key={field.id}>
                <td>{index + 1}.</td>
                <td>
                <Controller
                    control={control}
                    name={`payoutStructure.${index}.recipient_count` as const}
                    render={({ field }) => (
                      <input
                        type="number"
                        value={field.value}
                        onChange={(e) => {
                          const val = numberOr(e.target.valueAsNumber, 1);
                          field.onChange(val);
                          handleRecipientsChange(index, val);
                        }}
                        min={1}
                      />
                    )}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  <Controller
                    control={control}
                    name={`payoutStructure.${index}.percent_amount` as `payoutStructure.${number}.percent_amount`}
                    render={({ field }) => (
                      <input
                        type="number"
                        value={field.value}
                        onChange={(e) => {
                          const val = e.target.valueAsNumber
                          if (isNumber(val)) {
                            console.log(val);
                            // const val = numberOr(e.target.valueAsNumber, 0);
                            // field.onChange(val);
                            // handlePercentageChange(index, val);
                          }
                        }}
                      />
                    )}
                  />
          {" "}%
                </td>
                <td style={{ textAlign: "right" }}>
                  <Controller
                    control={control}
                    name={`payoutStructure.${index}.currency_amount` as `payoutStructure.${number}.currency_amount`}
                    render={({ field }) => (
                      <input
                        type="number"
                        value={field.value}
                        onChange={(e) => {
                          const val = numberOr(e.target.valueAsNumber, 0);
                          field.onChange(val);
                          handleCurrencyChange(index, val);
                        }}
                      />
                    )}
                  />
                  {" "}$
                </td>
                <td><button type="button" onClick={() => remove(index)}>x</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <br />
      <button type="button" onClick={() => append({recipient_count: 1, percent_amount: 0, currency_amount: 0})}>+ Add row</button>
        <p>Percent sum: {percent_sum}%</p>
          <button type="submit">Submit</button>
    </form>
  );
}
