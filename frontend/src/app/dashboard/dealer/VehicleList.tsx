export default function VehicleList() {
  return (
    <section
      aria-labelledby="inventory-heading"
      className="mt-8 overflow-hidden rounded-3xl border border-[#e2ded5] bg-[#fffdf9] shadow-sm"
    >
      <div className="flex flex-col gap-2 border-b border-[#e9e5dc] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <h2 id="inventory-heading" className="text-lg font-semibold tracking-tight text-[#123b35]">
            Vehicle inventory
          </h2>
          <p className="mt-1 text-sm text-[#68756f]">
            Manage the vehicles your customers can book.
          </p>
        </div>
        <span className="w-fit rounded-full bg-[#e9eee7] px-3 py-1 text-xs font-semibold text-[#245c4c]">
          0 vehicles
        </span>
      </div>

      <div className="px-6 py-14 text-center sm:px-8 sm:py-20">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4f1eb] text-2xl text-[#245c4c]" aria-hidden="true">
          ▱
        </div>
        <h3 className="mt-5 text-base font-semibold text-[#123b35]">Your inventory is clear</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#68756f]">
          Vehicles you add to your business will appear here. There are no vehicle listings to manage yet.
        </p>
      </div>
    </section>
  );
}
