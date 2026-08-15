Notes:

CURRENT DECISIONS

1. Order is initially a sales/business order, not a production order.

2. Sales creates the order.

3. Order goes through manager/admin approval.

4. Rejection requires a reason and preserves approval history.

5. Approved orders become available to workers.

6. Workers pick available orders themselves.

7. Worker assignment/pick history is stored because worker productivity
   and future bonuses depend on it.

8. OrderLine contains customer-specific bag requirements.

9. Current OrderLine intentionally stays simple:
   - dimensions
   - quantity
   - paper type
   - color count
   - reference file
   - notes

10. No separate BagSpecification/ProductSpecification table for now.

11. Salesperson is linked to User, not stored as a plain name.

12. Pricing approval/history must be preserved.

13. Editing an approved order requires re-approval.

14. Production stages are intentionally not being redesigned yet.

15. BOM, wastage, inventory redesign, delivery, invoice, payment,
    purchasing and accounting are future phases.

16. Later architectural relationship:
    Customer
    → Order
    → ProductionOrder
    → ProductionStage
