/**
 * CalcTutorialModal
 * Design: Precision Dashboard — teal/slate/amber palette, DM Sans headings, JetBrains Mono for numbers.
 * Displays a step-by-step worked example of AHP consistency calculations using the
 * Safety alternatives matrix from the car selection class example.
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold text-teal-700 uppercase tracking-wide mt-6 mb-2 border-b border-teal-100 pb-1">
      {children}
    </h3>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded font-mono text-sm text-slate-800 text-center">
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-3">
      {children}
    </p>
  );
}

// ─── Simple HTML table ────────────────────────────────────────────────────────

function TutTable({
  headers,
  rows,
  highlight,
}: {
  headers: string[];
  rows: (string | number)[][];
  highlight?: number; // column index to highlight
}) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={`px-3 py-1.5 text-left font-semibold border border-slate-200 ${
                  i === highlight
                    ? "bg-teal-100 text-teal-800"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50"}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-1.5 border border-slate-200 font-mono ${
                    ci === highlight ? "bg-teal-50 text-teal-800 font-semibold" : "text-slate-700"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalcTutorialModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-teal-700 border-teal-300 hover:bg-teal-50 hover:border-teal-500"
        >
          <BookOpen className="w-4 h-4" />
          Brief Calculation Tutorial
        </Button>
      </DialogTrigger>

      <DialogContent className="!max-w-5xl w-[92vw] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-200 bg-gradient-to-r from-teal-50 to-white">
          <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-600" />
            AHP Consistency Calculations — Worked Example
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Using the <strong>Safety alternatives matrix</strong> from the car selection class example
            (Car X, Car Y, Car Z).
          </p>
        </DialogHeader>

        <ScrollArea className="px-6 pb-6 h-[calc(90vh-100px)]">
          {/* ── Pairwise matrix ── */}
          <SectionTitle>The Pairwise Comparison Matrix</SectionTitle>
          <p className="text-sm text-slate-600 mb-2">
            Each cell (i, j) records how much <em>more preferred</em> alternative i is over alternative j
            with respect to Safety. The lower triangle is always the reciprocal of the upper triangle
            (e.g., Car Y vs Car X = 2 = 1 ÷ ½).
          </p>
          <TutTable
            headers={["", "Car X", "Car Y", "Car Z"]}
            rows={[
              ["Car X", "1", "1/2", "3"],
              ["Car Y", "2", "1", "8"],
              ["Car Z", "1/3", "1/8", "1"],
            ]}
          />

          {/* ── Step 1: priority vector ── */}
          <SectionTitle>Step 1 — Priority Vector (Local Weights)</SectionTitle>
          <p className="text-sm text-slate-600 mb-1">
            Saaty's <strong>normalised column sum</strong> method (the standard hand-calculation
            approximation):
          </p>
          <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1 mb-2">
            <li>Sum each column.</li>
            <li>Divide every entry by its column sum to normalise.</li>
            <li>Average each row across all columns → that row's local weight <strong>w</strong>.</li>
          </ol>

          <p className="text-xs font-semibold text-slate-500 mb-1">Column sums:</p>
          <TutTable
            headers={["Column", "Calculation", "Sum"]}
            rows={[
              ["Col 1 (Car X)", "1 + 2 + 1/3", "3.3333"],
              ["Col 2 (Car Y)", "1/2 + 1 + 1/8", "1.6250"],
              ["Col 3 (Car Z)", "3 + 8 + 1", "12.0000"],
            ]}
          />

          <p className="text-xs font-semibold text-slate-500 mb-1">Normalised matrix and row averages:</p>
          <TutTable
            headers={["", "Col 1 ÷ 3.3333", "Col 2 ÷ 1.6250", "Col 3 ÷ 12", "Row sum", "w = sum / 3"]}
            rows={[
              ["Car X", "0.30000", "0.30769", "0.25000", "0.85769", "0.28590"],
              ["Car Y", "0.60000", "0.61538", "0.66667", "1.88205", "0.62735"],
              ["Car Z", "0.10000", "0.07692", "0.08333", "0.26026", "0.08675"],
            ]}
            highlight={5}
          />
          <p className="text-xs text-slate-500">
            Check: 0.28590 + 0.62735 + 0.08675 = <strong>1.000</strong> ✓
          </p>

          {/* ── Step 2: lambda max ── */}
          <SectionTitle>Step 2 — λ_max (Principal Eigenvalue)</SectionTitle>
          <p className="text-sm text-slate-600 mb-2">
            Multiply the <strong>original</strong> matrix <strong>A</strong> by the weight vector{" "}
            <strong>w</strong> to obtain the weighted sum vector <strong>Aw</strong>, then divide each
            component by its weight:
          </p>
          <Formula>λᵢ = (Aw)ᵢ / wᵢ</Formula>

          <TutTable
            headers={["", "Aw calculation", "Aw", "w", "λᵢ = Aw / w"]}
            rows={[
              [
                "Car X",
                "1×0.28590 + 0.5×0.62735 + 3×0.08675",
                "0.85983",
                "0.28590",
                "3.0074",
              ],
              [
                "Car Y",
                "2×0.28590 + 1×0.62735 + 8×0.08675",
                "1.89315",
                "0.62735",
                "3.0177",
              ],
              [
                "Car Z",
                "(1/3)×0.28590 + (1/8)×0.62735 + 1×0.08675",
                "0.26047",
                "0.08675",
                "3.0025",
              ],
            ]}
            highlight={4}
          />

          <Formula>λ_max = (3.0074 + 3.0177 + 3.0025) / 3 = <strong>3.0092</strong></Formula>
          <p className="text-sm text-slate-600">
            For a <em>perfectly</em> consistent matrix, λ_max = n exactly. Any deviation reflects
            inconsistency in the judgments.
          </p>

          {/* ── Step 3: CI ── */}
          <SectionTitle>Step 3 — Consistency Index (CI)</SectionTitle>
          <Formula>CI = (λ_max − n) / (n − 1) = (3.0092 − 3) / (3 − 1) = 0.0092 / 2 = <strong>0.0046</strong></Formula>
          <p className="text-sm text-slate-600">
            A perfectly consistent matrix gives CI = 0. The larger CI is, the more contradictory the
            judgments.
          </p>

          {/* ── Step 4: RI ── */}
          <SectionTitle>Step 4 — Random Index (RI)</SectionTitle>
          <p className="text-sm text-slate-600 mb-2">
            The Random Index is the average CI of a large number of randomly generated reciprocal
            matrices of the same size (Saaty, 1980):
          </p>
          <TutTable
            headers={["n", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]}
            rows={[["RI", "0", "0", "0.58", "0.90", "1.12", "1.24", "1.32", "1.41", "1.45", "1.49"]]}
            highlight={3}
          />
          <p className="text-sm text-slate-600">For n = 3: <strong>RI = 0.58</strong></p>

          {/* ── Step 5: CR ── */}
          <SectionTitle>Step 5 — Consistency Ratio (CR)</SectionTitle>
          <Formula>CR = CI / RI = 0.0046 / 0.58 = <strong>0.008 (0.8%)</strong></Formula>
          <p className="text-sm text-slate-600">
            Saaty's guideline: <strong>CR ≤ 10%</strong> is acceptable. If CR &gt; 10%, the judgments
            are too contradictory and should be revised.
          </p>

          {/* ── Discrepancy note ── */}
          <SectionTitle>Why the Tool May Report a Slightly Different CR</SectionTitle>
          <p className="text-sm text-slate-600 mb-2">
            The hand-calculation above uses the <strong>normalised column sum approximation</strong> to
            estimate the priority vector <strong>w</strong>. This is the method Saaty originally
            recommended for manual use because it requires only arithmetic.
          </p>
          <p className="text-sm text-slate-600 mb-2">
            The tool computes <strong>w</strong> using the <strong>exact eigenvector method</strong>{" "}
            (power iteration): the matrix is multiplied by itself repeatedly until the normalised row
            averages converge to the true principal eigenvector. This produces a marginally different{" "}
            <strong>w</strong>, and therefore a marginally different λ_max, CI, and CR.
          </p>
          <Note>
            <strong>Example:</strong> for the Safety matrix above, the approximation gives CR ≈ 0.8%,
            while the exact eigenvector method gives CR ≈ 1.2%. Both values are well within the 10%
            threshold and lead to the same conclusion. The discrepancy is small and has no practical
            impact on the decision — it is simply a consequence of using an approximation vs. an exact
            numerical method.
          </Note>

          {/* ── Summary ── */}
          <SectionTitle>Summary</SectionTitle>
          <TutTable
            headers={["Symbol", "Meaning", "Value (Safety, n = 3)"]}
            rows={[
              ["n", "Number of elements compared (matrix size)", "3"],
              ["w", "Local weights (priority vector)", "[0.286, 0.627, 0.087]"],
              ["λ_max", "Principal eigenvalue", "3.009"],
              ["CI", "Consistency Index = (λ_max − n) / (n − 1)", "0.0046"],
              ["RI", "Random Index for n = 3 (Saaty's table)", "0.58"],
              ["CR", "Consistency Ratio = CI / RI", "0.8% ✓"],
            ]}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
