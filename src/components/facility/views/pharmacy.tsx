"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Pill, Plus, Search, Loader2, Package, AlertTriangle, IndianRupee, Edit2, Trash2, FlaskConical, Boxes } from "lucide-react";

interface Item {
  id: string; name: string; category: string; form: string; quantity: number;
  unit: string; reorderLevel: number; price: number; expiryDate: string | null;
  description: string | null; inStock: boolean;
}

const CATEGORIES = ["Formulation", "Distillate", "Khamira", "Tablet", "Oil", "Decoction", "Syrup", "General"];
const FORMS = ["Powder", "Liquid", "Tablet", "Semi-solid", "Oil", "Sachet", "Jar", "Bottle"];

export function PharmacyView() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [lowStock, setLowStock] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [form, setForm] = useState({
    name: "", category: "Formulation", form: "Powder", quantity: "", unit: "g",
    reorderLevel: "10", price: "", expiryDate: "", description: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category !== "all") params.set("category", category);
      const r = await api.get<{ items: Item[]; lowStock: number; totalValue: number }>(`/api/pharmacy?${params}`);
      setItems(r.items || []);
      setLowStock(r.lowStock);
      setTotalValue(r.totalValue);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, category]);

  const openAdd = () => { setForm({ name: "", category: "Formulation", form: "Powder", quantity: "", unit: "g", reorderLevel: "10", price: "", expiryDate: "", description: "" }); setEditItem(null); setAddOpen(true); };
  const openEdit = (it: Item) => {
    setForm({ name: it.name, category: it.category, form: it.form, quantity: String(it.quantity), unit: it.unit, reorderLevel: String(it.reorderLevel), price: String(it.price), expiryDate: it.expiryDate || "", description: it.description || "" });
    setEditItem(it); setAddOpen(true);
  };

  const save = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      if (editItem) {
        await api.patch(`/api/pharmacy/${editItem.id}`, form);
        toast.success("Item updated");
      } else {
        await api.post("/api/pharmacy", form);
        toast.success("Item added to pharmacy");
      }
      setAddOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const remove = async (it: Item) => {
    if (!confirm(`Remove ${it.name} from pharmacy?`)) return;
    try { await api.delete(`/api/pharmacy/${it.id}`); toast.success("Removed"); load(); } catch (e: any) { toast.error(e.message); }
  };

  const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold">Unani Pharmacy</h2>
          <p className="text-sm text-muted-foreground">Manage formulations, distillates and stock levels.</p>
        </div>
        <Button onClick={openAdd} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Add Item</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-border/50 bg-card/60">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center"><Boxes className="h-4 w-4 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Total Items</p><p className="font-serif text-xl font-bold">{items.length}</p></div>
          </div>
        </Card>
        <Card className="p-4 border-border/50 bg-card/60">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-accent/15 flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-accent" /></div>
            <div><p className="text-xs text-muted-foreground">Low Stock</p><p className="font-serif text-xl font-bold text-accent">{lowStock}</p></div>
          </div>
        </Card>
        <Card className="p-4 border-border/50 bg-card/60">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/15 flex items-center justify-center"><IndianRupee className="h-4 w-4 text-emerald-400" /></div>
            <div><p className="text-xs text-muted-foreground">Stock Value</p><p className="font-serif text-xl font-bold">{fmtINR(totalValue)}</p></div>
          </div>
        </Card>
        <Card className="p-4 border-border/50 bg-card/60">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-violet-500/15 flex items-center justify-center"><FlaskConical className="h-4 w-4 text-violet-300" /></div>
            <div><p className="text-xs text-muted-foreground">Categories</p><p className="font-serif text-xl font-bold">{CATEGORIES.length}</p></div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className="pl-9 bg-background/60" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[180px] bg-background/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Items grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading pharmacy…</div>
      ) : items.length === 0 ? (
        <Card className="p-10 border-border/50 bg-card/60 text-center">
          <Pill className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No items found. Add your first Unani formulation.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((it) => {
            const low = it.quantity <= it.reorderLevel;
            const out = it.quantity <= 0;
            return (
              <Card key={it.id} className={cn("p-4 bg-card/60 transition-colors", low ? "border-accent/40" : "border-border/50 hover:border-primary/40")}>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{it.category} · {it.form}</p>
                  </div>
                  {out ? <Badge className="text-destructive bg-destructive/15 border-destructive/30">OUT</Badge>
                    : low ? <Badge className="text-accent bg-accent/15 border-accent/30">LOW</Badge>
                    : <Badge className="text-emerald-300 bg-emerald-500/15 border-emerald-500/30">IN STOCK</Badge>}
                </div>
                {it.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{it.description}</p>}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Quantity</p><p className="font-semibold">{it.quantity} {it.unit}</p></div>
                  <div><p className="text-muted-foreground">Reorder</p><p className="font-semibold">{it.reorderLevel}</p></div>
                  <div><p className="text-muted-foreground">Price</p><p className="font-semibold text-primary">{fmtINR(it.price)}</p></div>
                </div>
                {it.expiryDate && <p className="text-[11px] text-muted-foreground mt-2">Expires: {it.expiryDate}</p>}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => openEdit(it)}><Edit2 className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                  <Button size="sm" variant="ghost" className="h-8 text-destructive hover:bg-destructive/10" onClick={() => remove(it)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editItem ? "Edit Item" : "Add Pharmacy Item"}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Majoon Suranjan" className="bg-background/60" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Form</Label>
              <Select value={form.form} onValueChange={(v) => setForm({ ...form, form: v })}>
                <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                <SelectContent>{FORMS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="bg-background/60" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="bg-background/60" />
            </div>
            <div className="space-y-1.5">
              <Label>Reorder Level</Label>
              <Input type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} className="bg-background/60" />
            </div>
            <div className="space-y-1.5">
              <Label>Price (₹)</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-background/60" />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="bg-background/60" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-background/60 min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editItem ? "Update" : "Add"} Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
