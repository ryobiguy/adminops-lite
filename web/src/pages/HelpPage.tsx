export default function HelpPage() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold">How this works</h2>
        <p className="text-sm text-gray-600 mt-1">
          This is a simple system to stop missed messages, forgotten callbacks, and customer chasing.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">The 10-second explanation for an owner</h3>
        <div className="text-sm text-gray-700">
          “Every call/message becomes a tracked task. Nothing gets lost. You can see what’s new, what’s overdue, and what’s waiting on you.”
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Owner rules (keep it simple)</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <div><span className="font-medium">New</span> = just came in</div>
          <div><span className="font-medium">In progress</span> = we’re handling it</div>
          <div><span className="font-medium">Waiting on you</span> = we need an answer (price/availability/decision)</div>
          <div><span className="font-medium">Done</span> = finished</div>
        </div>
      </div>
    </div>
  )
}
