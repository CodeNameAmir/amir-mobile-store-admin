// @ts-nocheck
/**
 * AMIR MOBILE STORE — Express Admin Phase Routes (Copy into your Render Backend repo)
 * Mount inside your existing authenticated `/api/admin` router (after requireAuth & requireAdmin).
 * Also register `app.use('/api', apiNotFoundJsonHandler)` BEFORE Express SPA `app.get('*')`
 * so unknown `/api/*` paths return JSON 404 instead of `index.html`.
 */
import type { NextFunction, Request, Response, Router } from 'express';
import express from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AuthenticatedRequest extends Request {
  authUser?: {
    id: string;
    email: string;
    role: string;
  };
}

export function apiNotFoundJsonHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'مسیر API درخواست‌شده در سرور یافت نشد.' });
}

export function createAdminPhaseRouter(deps: {
  supabase: SupabaseClient;
  writeAuditLog?: (params: {
    adminId?: string;
    adminEmail?: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown>;
  }) => Promise<void>;
}): Router {
  const router = express.Router();
  const { supabase } = deps;

  const logAction = async (
    req: AuthenticatedRequest,
    action: string,
    targetType: string,
    targetId: string,
    details: Record<string, unknown> = {}
  ) => {
    try {
      if (deps.writeAuditLog) {
        await deps.writeAuditLog({
          adminId: req.authUser?.id,
          adminEmail: req.authUser?.email,
          action,
          targetType,
          targetId,
          details,
        });
        return;
      }
      await supabase.from('admin_audit_logs').insert({
        admin_user_id: req.authUser?.id ?? null,
        admin_email: req.authUser?.email ?? 'admin@codenameamir.ir',
        action,
        target_type: targetType,
        target_id: targetId,
        details,
      });
    } catch {
      // Do not fail primary mutation if audit log insert throws
    }
  };

  // =========================================================================
  // 1. COUPONS & REDEMPTIONS (public.coupons + public.coupon_redemptions)
  // =========================================================================
  router.get('/coupons', async (_req, res, next) => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json({ coupons: data || [] });
    } catch (err) {
      next(err);
    }
  });

  router.post('/coupons', async (req: AuthenticatedRequest, res, next) => {
    try {
      const b = req.body || {};
      const code = String(b.code || '').trim().toUpperCase();
      if (!code) {
        res.status(400).json({ error: 'کد تخفیف الزامی است.' });
        return;
      }
      const payload = {
        code,
        discount_type: b.discountType === 'fixed' ? 'fixed' : 'percent',
        discount_value: Math.max(0, Number(b.discountValue || 0)),
        max_discount: b.maxDiscount != null ? Number(b.maxDiscount) : null,
        min_order_amount: Math.max(0, Number(b.minOrderAmount || 0)),
        is_active: b.isActive !== false,
        description_fa: String(b.descriptionFa || '').trim(),
        starts_at: b.startsAt || null,
        expires_at: b.expiresAt || null,
        usage_limit: b.usageLimit != null ? Number(b.usageLimit) : null,
        per_user_limit: b.perUserLimit != null ? Number(b.perUserLimit) : null,
      };
      const { data, error } = await supabase.from('coupons').insert(payload).select('*').single();
      if (error) throw error;
      await logAction(req, 'coupon.create', 'coupon', code, payload);
      res.status(201).json({ coupon: data });
    } catch (err) {
      next(err);
    }
  });

  const updateCouponHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const code = decodeURIComponent(String(req.params.code || '')).trim().toUpperCase();
      const b = req.body || {};
      const patch: Record<string, unknown> = {};
      if (b.discountType !== undefined) patch.discount_type = b.discountType === 'fixed' ? 'fixed' : 'percent';
      if (b.discountValue !== undefined) patch.discount_value = Math.max(0, Number(b.discountValue));
      if (b.maxDiscount !== undefined) patch.max_discount = b.maxDiscount != null ? Number(b.maxDiscount) : null;
      if (b.minOrderAmount !== undefined) patch.min_order_amount = Math.max(0, Number(b.minOrderAmount));
      if (b.isActive !== undefined) patch.is_active = Boolean(b.isActive);
      if (b.descriptionFa !== undefined) patch.description_fa = String(b.descriptionFa || '');
      if (b.startsAt !== undefined) patch.starts_at = b.startsAt || null;
      if (b.expiresAt !== undefined) patch.expires_at = b.expiresAt || null;
      if (b.usageLimit !== undefined) patch.usage_limit = b.usageLimit != null ? Number(b.usageLimit) : null;
      if (b.perUserLimit !== undefined) patch.per_user_limit = b.perUserLimit != null ? Number(b.perUserLimit) : null;

      const { data, error } = await supabase.from('coupons').update(patch).eq('code', code).select('*').single();
      if (error) throw error;
      await logAction(req, 'coupon.update', 'coupon', code, patch);
      res.json({ coupon: data });
    } catch (err) {
      next(err);
    }
  };
  router.patch('/coupons/:code', updateCouponHandler);
  router.put('/coupons/:code', updateCouponHandler);

  router.delete('/coupons/:code', async (req: AuthenticatedRequest, res, next) => {
    try {
      const code = decodeURIComponent(String(req.params.code || '')).trim().toUpperCase();
      const { error } = await supabase.from('coupons').delete().eq('code', code);
      if (error) throw error;
      await logAction(req, 'coupon.delete', 'coupon', code);
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/coupons/:code/redemptions', async (req, res, next) => {
    try {
      const code = decodeURIComponent(String(req.params.code || '')).trim().toUpperCase();
      const { data, error } = await supabase
        .from('coupon_redemptions')
        .select('*')
        .eq('coupon_code', code)
        .order('redeemed_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      res.json({ redemptions: data || [] });
    } catch (err) {
      next(err);
    }
  });

  // =========================================================================
  // 2. IMEI / DEVICE REGISTRY (public.product_devices)
  // =========================================================================
  router.get('/imei', async (req, res, next) => {
    try {
      const search = String(req.query.search || '').trim().toLowerCase();
      const status = String(req.query.status || '').trim();
      const productId = String(req.query.productId || '').trim();
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

      let query = supabase
        .from('product_devices')
        .select('*, products(name_fa)')
        .order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);
      if (productId) query = query.eq('product_id', productId);

      const { data, error } = await query;
      if (error) throw error;

      let items = (data || []).map((row) => ({
        ...row,
        product_name_fa: row.products?.name_fa ?? null,
      }));
      if (search) {
        items = items.filter((d) =>
          `${d.imei1} ${d.imei2 || ''} ${d.serial_number || ''} ${d.order_code || ''} ${d.product_id} ${d.product_name_fa || ''}`
            .toLowerCase()
            .includes(search)
        );
      }
      const total = items.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      res.json({
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total,
        page,
        pageSize,
        totalPages,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/imei/batch', async (req: AuthenticatedRequest, res, next) => {
    try {
      const b = req.body || {};
      const productId = String(b.productId || '').trim();
      const entries = Array.isArray(b.imeis) ? b.imeis : [];
      if (!productId || entries.length === 0) {
        res.status(400).json({ error: 'شناسه محصول و فهرست IMEI الزامی است.' });
        return;
      }
      const rows = entries.map((item) => ({
        product_id: productId,
        variant_id: b.variantId || null,
        warehouse_id: b.warehouseId || null,
        sku: b.sku || null,
        imei1: String(item.imei1 || '').trim(),
        imei2: item.imei2 ? String(item.imei2).trim() : null,
        serial_number: item.serialNumber ? String(item.serialNumber).trim() : null,
        status: 'in_stock',
        note: item.note ? String(item.note).trim() : null,
      }));
      const { data, error } = await supabase.from('product_devices').insert(rows).select('*');
      if (error) throw error;
      await logAction(req, 'imei.batch_register', 'product', productId, { count: (data || []).length });
      res.status(201).json({ createdCount: (data || []).length, devices: data || [] });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/imei/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body || {};
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (b.status !== undefined) patch.status = b.status;
      if (b.orderCode !== undefined) patch.order_code = b.orderCode || null;
      if (b.note !== undefined) patch.note = b.note || null;

      const { data, error } = await supabase
        .from('product_devices')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      await logAction(req, 'imei.update', 'product_device', id, patch);
      res.json({ device: data });
    } catch (err) {
      next(err);
    }
  });

  // =========================================================================
  // 3. PAYMENTS LEDGER & REFUNDS (public.payment_transactions + payment_refunds)
  // =========================================================================
  router.get('/payments', async (req, res, next) => {
    try {
      const search = String(req.query.search || '').trim().toLowerCase();
      const status = String(req.query.status || '').trim();
      const recon = String(req.query.reconciliationStatus || '').trim();
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 15));

      let query = supabase
        .from('payment_transactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);
      if (recon) query = query.eq('reconciliation_status', recon);

      const { data, error } = await query;
      if (error) throw error;
      let items = data || [];
      if (search) {
        items = items.filter((t) =>
          `${t.order_code} ${t.shaparak_ref || ''} ${t.authority || ''}`.toLowerCase().includes(search)
        );
      }
      const total = items.length;
      res.json({
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/payments/:id/refund', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body || {};
      const amountToman = Math.max(1, Number(b.amountToman || 0));
      const reason = String(b.reason || '').trim();
      if (!reason) {
        res.status(400).json({ error: 'علت استرداد وجه الزامی است.' });
        return;
      }
      const { data: tx, error: txErr } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('id', id)
        .single();
      if (txErr || !tx) {
        res.status(404).json({ error: 'تراکنش پرداخت یافت نشد.' });
        return;
      }

      const nextStatus = amountToman >= Number(tx.amount_toman) ? 'refunded' : 'partially_refunded';
      await supabase.from('payment_refunds').insert({
        transaction_id: tx.id,
        order_id: tx.order_id,
        order_code: tx.order_code,
        amount_toman: amountToman,
        reason,
        refund_ref: b.refundRef || null,
        status: 'completed',
        created_by: req.authUser?.id || null,
      });

      const { data: updated, error: updErr } = await supabase
        .from('payment_transactions')
        .update({ status: nextStatus })
        .eq('id', id)
        .select('*')
        .single();
      if (updErr) throw updErr;

      if (tx.order_code) {
        await supabase
          .from('orders')
          .update({ payment_status: nextStatus === 'refunded' ? 'refunded' : 'paid' })
          .eq('order_code', tx.order_code);
      }

      await logAction(req, 'payment.refund', 'payment', id, { amountToman, reason });
      res.json({ payment: updated });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/payments/:id/reconcile', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id || '');
      const reconciliationStatus = String(req.body?.reconciliationStatus || '');
      if (!['unmatched', 'matched', 'discrepancy'].includes(reconciliationStatus)) {
        res.status(400).json({ error: 'وضعیت مغایرت‌گیری معتبر نیست.' });
        return;
      }
      const { data, error } = await supabase
        .from('payment_transactions')
        .update({ reconciliation_status: reconciliationStatus })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      await logAction(req, 'payment.reconcile', 'payment', id, { reconciliationStatus });
      res.json({ payment: data });
    } catch (err) {
      next(err);
    }
  });

  // =========================================================================
  // 4. RETURNS / RMA WORKFLOW (public.order_returns)
  // =========================================================================
  router.get('/returns', async (req, res, next) => {
    try {
      const search = String(req.query.search || '').trim().toLowerCase();
      const status = String(req.query.status || '').trim();
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 15));

      let query = supabase.from('order_returns').select('*').order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;

      let items = data || [];
      if (search) {
        items = items.filter((r) =>
          `${r.return_code} ${r.order_code} ${r.customer_name || ''} ${r.customer_phone || ''}`
            .toLowerCase()
            .includes(search)
        );
      }
      const total = items.length;
      res.json({
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/returns/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body || {};
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        handled_by: req.authUser?.id || null,
      };
      if (b.status !== undefined) patch.status = b.status;
      if (b.adminNote !== undefined) patch.admin_note = b.adminNote;
      if (b.refundAmount !== undefined) patch.refund_amount = Math.max(0, Number(b.refundAmount));
      if (b.restoreStock !== undefined) patch.restore_stock = Boolean(b.restoreStock);

      const { data, error } = await supabase
        .from('order_returns')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;

      await logAction(req, 'return.update', 'order_return', id, patch);
      res.json({ returnRecord: data });
    } catch (err) {
      next(err);
    }
  });

  // =========================================================================
  // 5. SUPPORT TICKETS, REVIEWS, PRODUCT Q&A, NEWSLETTER
  // =========================================================================
  router.get('/tickets', async (req, res, next) => {
    try {
      const search = String(req.query.search || '').trim().toLowerCase();
      const status = String(req.query.status || '').trim();
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 12));

      let query = supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;

      let items = data || [];
      if (search) {
        items = items.filter((t) =>
          `${t.ticket_code} ${t.full_name} ${t.phone} ${t.order_code || ''} ${t.message}`
            .toLowerCase()
            .includes(search)
        );
      }
      const total = items.length;
      res.json({
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    } catch (err) {
      next(err);
    }
  });

  const updateTicketHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body || {};
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (b.status !== undefined) patch.status = b.status;
      if (b.priority !== undefined) patch.priority = b.priority;
      if (b.assignedTo !== undefined) patch.assigned_to = b.assignedTo;
      if (b.internalNote !== undefined) patch.internal_note = b.internalNote;
      if (b.slaDueAt !== undefined) patch.sla_due_at = b.slaDueAt;
      if (b.adminReply !== undefined) patch.admin_reply = b.adminReply;

      const { data, error } = await supabase
        .from('support_tickets')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      await logAction(req, 'ticket.update', 'support_ticket', id, patch);
      res.json({ ticket: data });
    } catch (err) {
      next(err);
    }
  };
  router.patch('/tickets/:id', updateTicketHandler);
  router.put('/tickets/:id', updateTicketHandler);

  router.get('/reviews', async (req, res, next) => {
    try {
      const search = String(req.query.search || '').trim().toLowerCase();
      const approved = String(req.query.approved || '');
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 12));

      let query = supabase
        .from('product_reviews')
        .select('*, products(name_fa)')
        .order('created_at', { ascending: false });
      if (approved === 'approved') query = query.eq('is_approved', true);
      if (approved === 'pending') query = query.eq('is_approved', false);

      const { data, error } = await query;
      if (error) throw error;
      let items = (data || []).map((r) => ({ ...r, product_name_fa: r.products?.name_fa ?? null }));
      if (search) {
        items = items.filter((r) =>
          `${r.author} ${r.comment} ${r.product_id} ${r.product_name_fa || ''}`.toLowerCase().includes(search)
        );
      }
      const total = items.length;
      res.json({
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/reviews/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id || '');
      const patch: Record<string, unknown> = {};
      if (req.body?.isApproved !== undefined) patch.is_approved = Boolean(req.body.isApproved);
      if (req.body?.verified !== undefined) patch.verified = Boolean(req.body.verified);
      const { data, error } = await supabase.from('product_reviews').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      await logAction(req, 'review.update', 'product_review', id, patch);
      res.json({ review: data });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/reviews/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id || '');
      const { error } = await supabase.from('product_reviews').delete().eq('id', id);
      if (error) throw error;
      await logAction(req, 'review.delete', 'product_review', id);
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/questions', async (req, res, next) => {
    try {
      const search = String(req.query.search || '').trim().toLowerCase();
      const published = String(req.query.published || '');
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 15));

      const { data, error } = await supabase
        .from('product_questions')
        .select('*, products(name_fa)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      let items = (data || []).map((q) => ({ ...q, product_name_fa: q.products?.name_fa ?? null }));
      if (published === 'published') items = items.filter((q) => q.is_published);
      if (published === 'unanswered') items = items.filter((q) => !q.answer);
      if (search) {
        items = items.filter((q) =>
          `${q.author_name} ${q.question} ${q.answer || ''} ${q.product_name_fa || ''}`
            .toLowerCase()
            .includes(search)
        );
      }
      const total = items.length;
      res.json({
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/questions/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body || {};
      const patch = {
        answer: String(b.answer || '').trim(),
        is_published: Boolean(b.isPublished),
        answered_by: req.authUser?.email || 'admin',
        answered_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('product_questions').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      await logAction(req, 'question.answer', 'product_question', id, patch);
      res.json({ question: data });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/questions/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id || '');
      const { error } = await supabase.from('product_questions').delete().eq('id', id);
      if (error) throw error;
      await logAction(req, 'question.delete', 'product_question', id);
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/newsletter', async (req, res, next) => {
    try {
      const search = String(req.query.search || '').trim().toLowerCase();
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 15));
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      let items = data || [];
      if (search) items = items.filter((s) => String(s.contact || '').toLowerCase().includes(search));
      const total = items.length;
      res.json({
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/newsletter/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id || '');
      const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', id);
      if (error) throw error;
      await logAction(req, 'newsletter.delete', 'newsletter', id);
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  // =========================================================================
  // 6. CONTENT CMS: POSTS, BANNERS & FAQS (cms_posts / cms_banners / cms_faqs)
  // =========================================================================
  router.get('/content/posts', async (_req, res, next) => {
    try {
      const { data, error } = await supabase
        .from('cms_posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json({ posts: data || [] });
    } catch (err) {
      next(err);
    }
  });

  router.post('/content/posts', async (req: AuthenticatedRequest, res, next) => {
    try {
      const b = req.body || {};
      const status = b.status === 'published' ? 'published' : 'draft';
      const payload = {
        slug: String(b.slug || '').trim().toLowerCase(),
        title_fa: String(b.titleFa || '').trim(),
        excerpt_fa: b.excerptFa || null,
        content_fa: String(b.contentFa || ''),
        cover_image: b.coverImage || null,
        category_fa: String(b.categoryFa || 'بررسی تخصصی'),
        status,
        seo_title: b.seoTitle || null,
        seo_description: b.seoDescription || null,
        published_at: status === 'published' ? new Date().toISOString() : null,
      };
      const { data, error } = await supabase.from('cms_posts').insert(payload).select('*').single();
      if (error) throw error;
      await logAction(req, 'cms.post_create', 'cms_post', String(data.id), { slug: payload.slug });
      res.status(201).json({ post: data });
    } catch (err) {
      next(err);
    }
  });

  const updatePostHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body || {};
      const status = b.status === 'published' ? 'published' : 'draft';
      const patch = {
        slug: String(b.slug || '').trim().toLowerCase(),
        title_fa: String(b.titleFa || '').trim(),
        excerpt_fa: b.excerptFa || null,
        content_fa: String(b.contentFa || ''),
        cover_image: b.coverImage || null,
        category_fa: String(b.categoryFa || 'بررسی تخصصی'),
        status,
        seo_title: b.seoTitle || null,
        seo_description: b.seoDescription || null,
        published_at: status === 'published' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('cms_posts').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      await logAction(req, 'cms.post_update', 'cms_post', id, { slug: patch.slug });
      res.json({ post: data });
    } catch (err) {
      next(err);
    }
  };
  router.patch('/content/posts/:id', updatePostHandler);
  router.put('/content/posts/:id', updatePostHandler);

  router.delete('/content/posts/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id || '');
      const { error } = await supabase.from('cms_posts').delete().eq('id', id);
      if (error) throw error;
      await logAction(req, 'cms.post_delete', 'cms_post', id);
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/content/banners', async (_req, res, next) => {
    try {
      const { data, error } = await supabase
        .from('cms_banners')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      res.json({ banners: data || [] });
    } catch (err) {
      next(err);
    }
  });

  router.post('/content/banners', async (req: AuthenticatedRequest, res, next) => {
    try {
      const b = req.body || {};
      const payload = {
        title_fa: String(b.titleFa || '').trim(),
        subtitle_fa: b.subtitleFa || null,
        image_url: String(b.imageUrl || '').trim(),
        link_url: b.linkUrl || null,
        placement: String(b.placement || 'home_hero'),
        sort_order: Number(b.sortOrder || 1),
        is_active: b.isActive !== false,
      };
      const { data, error } = await supabase.from('cms_banners').insert(payload).select('*').single();
      if (error) throw error;
      res.status(201).json({ banner: data });
    } catch (err) {
      next(err);
    }
  });

  const updateBannerHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body || {};
      const patch = {
        title_fa: String(b.titleFa || '').trim(),
        subtitle_fa: b.subtitleFa || null,
        image_url: String(b.imageUrl || '').trim(),
        link_url: b.linkUrl || null,
        placement: String(b.placement || 'home_hero'),
        sort_order: Number(b.sortOrder || 1),
        is_active: b.isActive !== false,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('cms_banners').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      res.json({ banner: data });
    } catch (err) {
      next(err);
    }
  };
  router.patch('/content/banners/:id', updateBannerHandler);
  router.put('/content/banners/:id', updateBannerHandler);

  router.delete('/content/banners/:id', async (req, res, next) => {
    try {
      const { error } = await supabase.from('cms_banners').delete().eq('id', String(req.params.id || ''));
      if (error) throw error;
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/content/faqs', async (_req, res, next) => {
    try {
      const { data, error } = await supabase
        .from('cms_faqs')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      res.json({ faqs: data || [] });
    } catch (err) {
      next(err);
    }
  });

  router.post('/content/faqs', async (req, res, next) => {
    try {
      const b = req.body || {};
      const payload = {
        category_fa: String(b.categoryFa || 'عمومی'),
        question_fa: String(b.questionFa || '').trim(),
        answer_fa: String(b.answerFa || '').trim(),
        sort_order: Number(b.sortOrder || 1),
        is_active: b.isActive !== false,
      };
      const { data, error } = await supabase.from('cms_faqs').insert(payload).select('*').single();
      if (error) throw error;
      res.status(201).json({ faq: data });
    } catch (err) {
      next(err);
    }
  });

  const updateFaqHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body || {};
      const patch = {
        category_fa: String(b.categoryFa || 'عمومی'),
        question_fa: String(b.questionFa || '').trim(),
        answer_fa: String(b.answerFa || '').trim(),
        sort_order: Number(b.sortOrder || 1),
        is_active: b.isActive !== false,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('cms_faqs').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      res.json({ faq: data });
    } catch (err) {
      next(err);
    }
  };
  router.patch('/content/faqs/:id', updateFaqHandler);
  router.put('/content/faqs/:id', updateFaqHandler);

  router.delete('/content/faqs/:id', async (req, res, next) => {
    try {
      const { error } = await supabase.from('cms_faqs').delete().eq('id', String(req.params.id || ''));
      if (error) throw error;
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  // =========================================================================
  // 7. SHIPPING METHODS, SUPPLIERS, PURCHASE ORDERS, NOTIFICATIONS & BULK
  // =========================================================================
  router.get('/shipping-methods', async (_req, res, next) => {
    try {
      const { data, error } = await supabase
        .from('shipping_methods')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      res.json({ shippingMethods: data || [] });
    } catch (err) {
      next(err);
    }
  });

  router.post('/shipping-methods', async (req, res, next) => {
    try {
      const b = req.body || {};
      const payload = {
        code: String(b.code || '').trim(),
        name_fa: String(b.nameFa || '').trim(),
        carrier: String(b.carrier || 'post_pishtaz'),
        description_fa: String(b.descriptionFa || ''),
        base_cost_toman: Math.max(0, Number(b.baseCostToman || 0)),
        free_above_toman: b.freeAboveToman != null ? Number(b.freeAboveToman) : null,
        estimated_days: String(b.estimatedDays || '۱ تا ۳ روز کاری'),
        supported_cities: Array.isArray(b.supportedCities) ? b.supportedCities : [],
        is_express: Boolean(b.isExpress),
        is_active: b.isActive !== false,
        sort_order: Number(b.sortOrder || 10),
      };
      const { data, error } = await supabase.from('shipping_methods').insert(payload).select('*').single();
      if (error) throw error;
      res.status(201).json({ shippingMethod: data });
    } catch (err) {
      next(err);
    }
  });

  const updateShippingHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body || {};
      const patch = {
        code: String(b.code || '').trim(),
        name_fa: String(b.nameFa || '').trim(),
        carrier: String(b.carrier || 'post_pishtaz'),
        description_fa: String(b.descriptionFa || ''),
        base_cost_toman: Math.max(0, Number(b.baseCostToman || 0)),
        free_above_toman: b.freeAboveToman != null ? Number(b.freeAboveToman) : null,
        estimated_days: String(b.estimatedDays || '۱ تا ۳ روز کاری'),
        supported_cities: Array.isArray(b.supportedCities) ? b.supportedCities : [],
        is_express: Boolean(b.isExpress),
        is_active: b.isActive !== false,
        sort_order: Number(b.sortOrder || 10),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('shipping_methods').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      res.json({ shippingMethod: data });
    } catch (err) {
      next(err);
    }
  };
  router.patch('/shipping-methods/:id', updateShippingHandler);
  router.put('/shipping-methods/:id', updateShippingHandler);

  router.delete('/shipping-methods/:id', async (req, res, next) => {
    try {
      const { error } = await supabase.from('shipping_methods').delete().eq('id', String(req.params.id || ''));
      if (error) throw error;
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/notifications', async (_req, res, next) => {
    try {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      res.json({ notifications: data || [] });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/notifications/:id/read', async (req, res, next) => {
    try {
      const { error } = await supabase
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('id', String(req.params.id || ''));
      if (error) throw error;
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/products/bulk', async (req: AuthenticatedRequest, res, next) => {
    try {
      const b = req.body || {};
      const ids: string[] = Array.isArray(b.productIds) ? b.productIds.map(String) : [];
      if (ids.length === 0) {
        res.status(400).json({ error: 'حداقل یک محصول انتخاب کنید.' });
        return;
      }
      if (b.action === 'publish' || b.action === 'unpublish') {
        const { error } = await supabase
          .from('products')
          .update({ is_published: b.action === 'publish', updated_at: new Date().toISOString() })
          .in('id', ids);
        if (error) throw error;
      } else if (b.action === 'set_category' && b.categoryId) {
        const { error } = await supabase
          .from('products')
          .update({ category: String(b.categoryId), category_id: String(b.categoryId), updated_at: new Date().toISOString() })
          .in('id', ids);
        if (error) throw error;
      } else if (b.action === 'adjust_price_percent' || b.action === 'adjust_price_fixed') {
        const { data: rows, error } = await supabase.from('products').select('id, price').in('id', ids);
        if (error) throw error;
        const delta = Number(b.value || 0);
        for (const r of rows || []) {
          const cur = Number(r.price || 0);
          const nextPrice =
            b.action === 'adjust_price_percent'
              ? Math.max(0, Math.round(cur * (1 + delta / 100)))
              : Math.max(0, Math.round(cur + delta));
          await supabase
            .from('products')
            .update({ price: nextPrice, price_updated_at: new Date().toISOString() })
            .eq('id', r.id);
        }
      }
      await logAction(req, 'products.bulk', 'product', ids.join(','), b);
      res.json({ updatedCount: ids.length });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
