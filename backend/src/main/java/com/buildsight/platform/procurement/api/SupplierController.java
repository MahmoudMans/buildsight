package com.buildsight.platform.procurement.api;

import java.util.List;
import java.util.UUID;

import com.buildsight.platform.procurement.service.ProcurementControlService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/suppliers")
public class SupplierController {

    private final ProcurementControlService
            procurementControlService;

    public SupplierController(
            ProcurementControlService procurementControlService) {

        this.procurementControlService =
                procurementControlService;
    }

    @GetMapping
    public List<SupplierResponse> findAll() {

        return procurementControlService
                .suppliers();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SupplierResponse create(
            @Valid
            @RequestBody
            CreateSupplierRequest request) {

        return procurementControlService
                .createSupplier(
                        request);
    }

    @PutMapping("/{supplierId}")
    public SupplierResponse update(
            @PathVariable UUID supplierId,
            @Valid
            @RequestBody
            UpdateSupplierRequest request) {

        return procurementControlService
                .updateSupplier(
                        supplierId,
                        request);
    }
}
