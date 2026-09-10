package com.buildsight.platform.procurement.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "suppliers")
public class Supplier {

    @Id
    @Column(
            name = "id",
            nullable = false,
            updatable = false)
    private UUID id;

    @Column(
            name = "code",
            nullable = false,
            unique = true,
            length = 40)
    private String code;

    @Column(
            name = "name",
            nullable = false,
            length = 180)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "supplier_type",
            nullable = false,
            length = 32)
    private SupplierType supplierType;

    @Column(
            name = "trade",
            length = 160)
    private String trade;

    @Column(
            name = "country",
            length = 100)
    private String country;

    @Column(
            name = "contact_person",
            length = 160)
    private String contactPerson;

    @Column(
            name = "email",
            length = 254)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "qualification_status",
            nullable = false,
            length = 32)
    private SupplierQualificationStatus qualificationStatus;

    @Version
    @Column(
            name = "version",
            nullable = false)
    private long version;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    @Column(
            name = "updated_at",
            nullable = false)
    private Instant updatedAt;

    protected Supplier() {
    }

    private Supplier(
            UUID id,
            String code,
            String name,
            SupplierType supplierType,
            String trade,
            String country,
            String contactPerson,
            String email,
            SupplierQualificationStatus qualificationStatus) {

        this.id = Objects.requireNonNull(id);
        this.code = Objects.requireNonNull(code);
        this.name = Objects.requireNonNull(name);
        this.supplierType =
                Objects.requireNonNull(supplierType);
        this.trade = trade;
        this.country = country;
        this.contactPerson = contactPerson;
        this.email = email;
        this.qualificationStatus =
                Objects.requireNonNull(
                        qualificationStatus);
    }

    public static Supplier create(
            UUID id,
            String code,
            String name,
            SupplierType supplierType,
            String trade,
            String country,
            String contactPerson,
            String email,
            SupplierQualificationStatus qualificationStatus) {

        return new Supplier(
                id,
                code,
                name,
                supplierType,
                trade,
                country,
                contactPerson,
                email,
                qualificationStatus);
    }

    public void update(
            String name,
            SupplierType supplierType,
            String trade,
            String country,
            String contactPerson,
            String email,
            SupplierQualificationStatus qualificationStatus) {

        this.name =
                Objects.requireNonNull(name);

        this.supplierType =
                Objects.requireNonNull(
                        supplierType);

        this.trade = trade;
        this.country = country;
        this.contactPerson = contactPerson;
        this.email = email;

        this.qualificationStatus =
                Objects.requireNonNull(
                        qualificationStatus);
    }

    @PrePersist
    void onCreate() {
        Instant now =
                Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt =
                Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public SupplierType getSupplierType() {
        return supplierType;
    }

    public String getTrade() {
        return trade;
    }

    public String getCountry() {
        return country;
    }

    public String getContactPerson() {
        return contactPerson;
    }

    public String getEmail() {
        return email;
    }

    public SupplierQualificationStatus
    getQualificationStatus() {
        return qualificationStatus;
    }

    public long getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
