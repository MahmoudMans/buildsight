package com.buildsight.platform.procurement.api;

import com.buildsight.platform.procurement.domain.SupplierQualificationStatus;
import com.buildsight.platform.procurement.domain.SupplierType;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateSupplierRequest(

        @NotBlank(
                message = "Supplier code is required.")
        @Size(
                max = 40,
                message = "Supplier code cannot exceed 40 characters.")
        @Pattern(
                regexp = "[A-Za-z0-9][A-Za-z0-9._-]*",
                message = "Supplier code may contain letters, numbers, dots, hyphens and underscores.")
        String code,

        @NotBlank(
                message = "Supplier name is required.")
        @Size(
                max = 180,
                message = "Supplier name cannot exceed 180 characters.")
        String name,

        @NotNull(
                message = "Supplier type is required.")
        SupplierType supplierType,

        @Size(
                max = 160,
                message = "Trade cannot exceed 160 characters.")
        String trade,

        @Size(
                max = 100,
                message = "Country cannot exceed 100 characters.")
        String country,

        @Size(
                max = 160,
                message = "Contact person cannot exceed 160 characters.")
        String contactPerson,

        @Email(
                message = "Supplier email must be valid.")
        @Size(
                max = 254,
                message = "Email cannot exceed 254 characters.")
        String email,

        @NotNull(
                message = "Qualification status is required.")
        SupplierQualificationStatus qualificationStatus) {
}
