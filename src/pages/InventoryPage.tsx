import { useCallback, useEffect, useState } from 'react';
import { Boxes, History, Plus, Warehouse as WarehouseIcon } from 'lucide-react';
import type { Warehouse, WarehouseStockItem } from '../types/admin';
import { adminApi } from '../services/adminApi';
import { useRouter } from '../router';
import { Button } from '../components/ui/Button';
import { WarehousesTab } from '../components/inventory/WarehousesTab';
import { WarehouseStockTab } from '../components/inventory/WarehouseStockTab';
import { StockMovementsTab } from '../components/inventory/StockMovementsTab';
import { StockMovementModal } from '../components/inventory/StockMovementModal';

type InventoryTabKey = 'stock' | 'warehouses' | 'movements';

const TABS: Array<{ key: InventoryTabKey; label: string; icon: typeof Boxes }> = [
  { key: 'warehouses', label: 'انبارها', icon: WarehouseIcon },
  { key: 'stock', label: 'موجودی لحظه‌ای قفسه‌ها', icon: Boxes },
  { key: 'movements', label: 'دفترکل ورود و خروج کالا', icon: History },
];

export function InventoryPage() {
  const { searchParams, navigate } = useRouter();
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<InventoryTabKey>(
    initialTab === 'warehouses' || initialTab === 'movements' || initialTab === 'stock'
      ? initialTab
      : 'stock'
  );

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [prefillStock, setPrefillStock] = useState<WarehouseStockItem | null>(null);

  const loadWarehousesList = useCallback(async () => {
    try {
      const res = await adminApi.listWarehouses();
      setWarehouses(Array.isArray(res.warehouses) ? res.warehouses : []);
    } catch {
      // Handled inside individual tabs if needed
    }
  }, []);

  useEffect(() => {
    void loadWarehousesList();
  }, [loadWarehousesList]);

  useEffect(() => {
    const param = searchParams.get('tab');
    if (param === 'warehouses' || param === 'movements' || param === 'stock') {
      setActiveTab(param);
    }
  }, [searchParams]);

  const handleSelectTab = (tab: InventoryTabKey) => {
    setActiveTab(tab);
    navigate(`/inventory?tab=${tab}`, { replace: true });
  };

  const handleOpenNewMovement = (stockItem: WarehouseStockItem | null = null) => {
    setPrefillStock(stockItem);
    setMovementModalOpen(true);
  };

  const handleMovementSuccess = () => {
    setRefreshSignal((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#111315]">انبار و موجودی</h1>
          <p className="mt-1 text-xs text-[#52565e]">
            مدیریت انبارها، موجودی قفسه‌ها و دفترکل ورود و خروج کالا
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => handleOpenNewMovement(null)}
          icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
        >
          ثبت تراکنش جدید انبار
        </Button>
      </div>

      <div
        className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#f1f2f4] border border-black/[0.06] w-fit"
        role="tablist"
        aria-label="بخش‌های انبار و موجودی"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleSelectTab(tab.key)}
              className={`inline-flex items-center gap-2 px-3.5 h-8 rounded-md text-xs transition-colors duration-150 whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                  : 'text-[#52565e] hover:text-[#111315] font-medium'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'warehouses' && (
        <WarehousesTab onWarehousesChanged={() => void loadWarehousesList()} />
      )}
      {activeTab === 'stock' && (
        <WarehouseStockTab
          warehouses={warehouses}
          refreshSignal={refreshSignal}
          onOpenMovementForStock={(item) => handleOpenNewMovement(item)}
        />
      )}
      {activeTab === 'movements' && (
        <StockMovementsTab
          warehouses={warehouses}
          refreshSignal={refreshSignal}
          onOpenNewMovement={() => handleOpenNewMovement(null)}
        />
      )}

      <StockMovementModal
        open={movementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        warehouses={warehouses}
        initialWarehouseId={prefillStock?.warehouseId}
        initialVariantId={prefillStock?.variantId}
        initialProductId={prefillStock?.productId}
        initialSku={prefillStock?.sku}
        onSuccess={handleMovementSuccess}
      />
    </div>
  );
}
