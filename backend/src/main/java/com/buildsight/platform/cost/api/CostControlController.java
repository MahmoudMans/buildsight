package com.buildsight.platform.cost.api;

import java.util.UUID;

import com.buildsight.platform.cost.service.CostControlService;

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
@RequestMapping(
        "/api/v1/projects/{projectId}/cost-control")
public class CostControlController {

    private final CostControlService
            costControlService;

    public CostControlController(
            CostControlService costControlService) {

        this.costControlService =
                costControlService;
    }

    @GetMapping
    public CostControlResponse get(
            @PathVariable UUID projectId) {

        return costControlService.get(
                projectId);
    }

    @PostMapping("/cost-codes")
    @ResponseStatus(HttpStatus.CREATED)
    public CostCodeResponse createCostCode(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateCostCodeRequest request) {

        return costControlService
                .createCostCode(
                        projectId,
                        request);
    }

    @PostMapping("/budget-lines")
    @ResponseStatus(HttpStatus.CREATED)
    public BudgetLineResponse createBudgetLine(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateBudgetLineRequest request) {

        return costControlService
                .createBudgetLine(
                        projectId,
                        request);
    }

    @PutMapping(
            "/budget-lines/{budgetLineId}")
    public BudgetLineResponse updateBudgetLine(
            @PathVariable UUID projectId,
            @PathVariable UUID budgetLineId,
            @Valid
            @RequestBody
            UpdateBudgetLineRequest request) {

        return costControlService
                .updateBudgetLine(
                        projectId,
                        budgetLineId,
                        request);
    }

    @PostMapping("/commitments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommitmentResponse createCommitment(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateCommitmentRequest request) {

        return costControlService
                .createCommitment(
                        projectId,
                        request);
    }

    @PutMapping(
            "/commitments/{commitmentId}")
    public CommitmentResponse updateCommitment(
            @PathVariable UUID projectId,
            @PathVariable UUID commitmentId,
            @Valid
            @RequestBody
            UpdateCommitmentRequest request) {

        return costControlService
                .updateCommitment(
                        projectId,
                        commitmentId,
                        request);
    }

    @PostMapping("/actual-costs")
    @ResponseStatus(HttpStatus.CREATED)
    public ActualCostResponse createActualCost(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateActualCostRequest request) {

        return costControlService
                .createActualCost(
                        projectId,
                        request);
    }
}
